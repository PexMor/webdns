mod config;
mod dns;
mod version;
mod ws;

use axum::http::header::{CACHE_CONTROL, HeaderValue};
use axum::{Router, routing::get};
use config::AppConfig;
use dns::ResolverCache;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;

pub struct AppState {
    pub config: AppConfig,
    pub resolvers: ResolverCache,
}

fn static_cache_control_header(seconds: u64) -> HeaderValue {
    HeaderValue::from_str(&format!("max-age={seconds}"))
        .expect("static_cache_seconds produces a valid header value")
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_ansi(true).init();

    let config = AppConfig::load().expect("Failed to load configuration. Check your arguments or config.toml.");
    let bind_addr = config.bind.clone();
    let serve_web = config.serve_web;
    let web_root = config.web_root.clone();
    let static_cache_seconds = config.static_cache_seconds;
    let resolvers =
        ResolverCache::with_secure_mode(config.secure_mode, config.allowed_dns_servers.clone());
    let state = Arc::new(AppState { config, resolvers });

    let mut app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .route("/version", get(version::version_handler));

    if serve_web {
        tracing::info!("Serving web app from {}", web_root.display());
        let static_service = ServiceBuilder::new()
            .layer(SetResponseHeaderLayer::overriding(
                CACHE_CONTROL,
                static_cache_control_header(static_cache_seconds),
            ))
            .service(ServeDir::new(web_root));
        app = app.fallback_service(static_service);
    } else {
        tracing::info!("Web app serving disabled (API-only mode)");
    }

    let app = app.layer(CorsLayer::permissive()).with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await.unwrap();
    version::log_startup_banner(&bind_addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    #[test]
    fn static_cache_control_header_uses_default_600() {
        assert_eq!(
            static_cache_control_header(600),
            HeaderValue::from_static("max-age=600")
        );
    }

    #[test]
    fn static_cache_control_header_reflects_override() {
        assert_eq!(
            static_cache_control_header(3600),
            HeaderValue::from_static("max-age=3600")
        );
    }

    #[tokio::test]
    async fn served_static_file_has_configured_cache_control() {
        let dir = std::env::temp_dir().join(format!(
            "dns-backend-static-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("index.html"), b"<html></html>").unwrap();

        let static_service = ServiceBuilder::new()
            .layer(SetResponseHeaderLayer::overriding(
                CACHE_CONTROL,
                static_cache_control_header(3600),
            ))
            .service(ServeDir::new(&dir));

        let response = static_service
            .oneshot(
                Request::builder()
                    .uri("/index.html")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.headers().get(CACHE_CONTROL),
            Some(&HeaderValue::from_static("max-age=3600"))
        );

        std::fs::remove_dir_all(&dir).ok();
    }
}
