use crate::dns::{DnsRequest, resolve_dns};
use crate::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::HeaderMap,
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;

fn header_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
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
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let unauthorized = || {
        axum::response::Response::builder()
            .status(axum::http::StatusCode::UNAUTHORIZED)
            .body(axum::body::Body::from("Unauthorized"))
            .unwrap()
    };

    let extracted = extract_api_key(&params, &headers);
    if is_authorized(extracted.as_deref(), &state.config.api_key) {
        ws.on_upgrade(move |socket| handle_socket(socket, state))
    } else {
        unauthorized().into_response()
    }
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    tracing::info!("client connected");
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

    tracing::info!("client disconnected");
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
}
