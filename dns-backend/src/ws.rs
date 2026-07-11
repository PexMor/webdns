use crate::dns::{DnsRequest, resolve_dns};
use crate::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Query, State,
    },
    http::HeaderMap,
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

fn header_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

/// Resolves the logical client address for a connection, preferring the
/// first `X-Forwarded-For` entry (set by `cloudflared`/reverse proxies)
/// over the raw TCP peer address, which is otherwise just the proxy.
pub fn resolve_client_addr(headers: &HeaderMap, peer: SocketAddr) -> String {
    if let Some(forwarded) = header_value(headers, "x-forwarded-for") {
        if let Some(first) = forwarded.split(',').next() {
            let trimmed = first.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    peer.to_string()
}

pub fn extract_api_key(params: &HashMap<String, String>, headers: &HeaderMap) -> Option<String> {
    if let Some(key) = params.get("apikey") {
        return Some(key.clone());
    }

    if let Some(key) = header_value(headers, "x-api-key") {
        return Some(key);
    }

    if let Some(auth) = header_value(headers, "authorization") {
        let key = auth
            .strip_prefix("Bearer ")
            .or_else(|| auth.strip_prefix("bearer "))
            .unwrap_or(&auth);
        return Some(key.to_string());
    }

    header_value(headers, "apikey")
}

fn is_authorized(extracted: Option<&str>, configured: &str) -> bool {
    extracted.is_some_and(|key| key == configured)
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let unauthorized = || {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::UNAUTHORIZED)
            .body(axum::body::Body::from("Unauthorized"))
            .unwrap()
    };

    let client_addr = resolve_client_addr(&headers, peer);
    let forwarded_proto = header_value(&headers, "x-forwarded-proto");
    let extracted = extract_api_key(&params, &headers);
    if is_authorized(extracted.as_deref(), &state.config.api_key) {
        ws.on_upgrade(move |socket| handle_socket(socket, state, client_addr, forwarded_proto))
    } else {
        unauthorized().into_response()
    }
}

async fn handle_socket(
    socket: WebSocket,
    state: Arc<AppState>,
    client_addr: String,
    forwarded_proto: Option<String>,
) {
    tracing::info!(
        client = %client_addr,
        proto = %forwarded_proto.as_deref().unwrap_or("-"),
        "client connected"
    );
    let (mut sender, mut receiver) = socket.split();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            let req: DnsRequest = match serde_json::from_str(&text) {
                Ok(parsed) => parsed,
                Err(e) => {
                    tracing::warn!("invalid JSON from client: {e}");
                    let err_body = serde_json::json!({ "error": format!("Invalid JSON: {e}") });
                    if sender
                        .send(Message::Text(err_body.to_string().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                    continue;
                }
            };

            let resolver = match state.resolvers.get(req.dns_server.as_deref()) {
                Ok(resolver) => resolver,
                Err(message) => {
                    tracing::warn!("invalid dns_server from client: {message}");
                    let err_body = serde_json::json!({ "error": message });
                    if sender
                        .send(Message::Text(err_body.to_string().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                    continue;
                }
            };

            let dns_response = resolve_dns(&resolver, req).await;

            match serde_json::to_string(&dns_response) {
                Ok(serialized) => {
                    if sender.send(Message::Text(serialized.into())).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!("failed to serialize DNS response: {e}");
                    break;
                }
            }
        }
    }

    tracing::info!(client = %client_addr, "client disconnected");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::header::{AUTHORIZATION, HeaderValue};

    #[test]
    fn extract_api_key_from_query_param() {
        let mut params = HashMap::new();
        params.insert("apikey".to_string(), "secret".to_string());
        let headers = HeaderMap::new();

        assert_eq!(
            extract_api_key(&params, &headers).as_deref(),
            Some("secret")
        );
    }

    #[test]
    fn extract_api_key_from_x_api_key_header() {
        let params = HashMap::new();
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static("header-secret"));

        assert_eq!(
            extract_api_key(&params, &headers).as_deref(),
            Some("header-secret")
        );
    }

    #[test]
    fn extract_api_key_from_authorization_bearer_header() {
        let params = HashMap::new();
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer bearer-secret"),
        );

        assert_eq!(
            extract_api_key(&params, &headers).as_deref(),
            Some("bearer-secret")
        );
    }

    #[test]
    fn query_param_takes_precedence_over_headers() {
        let mut params = HashMap::new();
        params.insert("apikey".to_string(), "query-secret".to_string());
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static("header-secret"));

        assert_eq!(
            extract_api_key(&params, &headers).as_deref(),
            Some("query-secret")
        );
    }

    #[test]
    fn is_authorized_matches_configured_key() {
        assert!(is_authorized(Some("abc"), "abc"));
        assert!(!is_authorized(Some("wrong"), "abc"));
        assert!(!is_authorized(None, "abc"));
    }

    #[test]
    fn resolve_client_addr_prefers_forwarded_for() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.7, 10.0.0.1"),
        );
        let peer: SocketAddr = "127.0.0.1:9999".parse().unwrap();

        assert_eq!(resolve_client_addr(&headers, peer), "203.0.113.7");
    }

    #[test]
    fn resolve_client_addr_falls_back_to_peer_without_forwarded_header() {
        let headers = HeaderMap::new();
        let peer: SocketAddr = "127.0.0.1:9999".parse().unwrap();

        assert_eq!(resolve_client_addr(&headers, peer), "127.0.0.1:9999");
    }

    #[test]
    fn resolve_client_addr_falls_back_to_peer_on_blank_forwarded_header() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("  "));
        let peer: SocketAddr = "127.0.0.1:9999".parse().unwrap();

        assert_eq!(resolve_client_addr(&headers, peer), "127.0.0.1:9999");
    }
}
