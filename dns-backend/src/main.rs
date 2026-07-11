mod config;
mod dns;
mod version;
mod ws;

use axum::{Router, routing::get};
use config::AppConfig;
use dns::ResolverCache;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

pub struct AppState {
    pub config: AppConfig,
    pub resolvers: ResolverCache,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_ansi(true).init();

    let config = AppConfig::load().expect("Failed to load configuration. Check your arguments or config.toml.");
    let bind_addr = config.bind.clone();
    let serve_web = config.serve_web;
    let web_root = config.web_root.clone();
    let resolvers = ResolverCache::new();
    let state = Arc::new(AppState { config, resolvers });

    let mut app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .route("/version", get(version::version_handler));

    if serve_web {
        tracing::info!("Serving web app from {}", web_root.display());
        app = app.fallback_service(ServeDir::new(web_root));
    } else {
        tracing::info!("Web app serving disabled (API-only mode)");
    }

    let app = app.layer(CorsLayer::permissive()).with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await.unwrap();
    version::log_startup_banner(&bind_addr);

    axum::serve(listener, app).await.unwrap();
}
