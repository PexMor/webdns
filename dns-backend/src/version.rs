use axum::http::header::{CACHE_CONTROL, HeaderValue};
use axum::response::IntoResponse;
use axum::Json;
use nu_ansi_term::{Color, Style};
use serde::Serialize;

#[derive(Serialize)]
pub struct VersionInfo {
    pub version: String,
    #[serde(rename = "gitHash")]
    pub git_hash: String,
    #[serde(rename = "buildTime")]
    pub build_time: String,
}

pub fn log_startup_banner(bind_addr: &str) {
    let name = Style::new().fg(Color::Cyan).bold().paint("DNS Backend");
    let version = env!("CARGO_PKG_VERSION");
    let git_hash = Style::new().fg(Color::Green).paint(env!("GIT_HASH"));
    let build_time = Style::new().fg(Color::Fixed(245)).paint(env!("BUILD_TIME"));

    eprintln!("{name} v{version} {git_hash} {build_time} — listening on {bind_addr}");
}

pub async fn version_handler() -> impl IntoResponse {
    let mut response = Json(VersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_hash: env!("GIT_HASH").to_string(),
        build_time: env!("BUILD_TIME").to_string(),
    })
    .into_response();

    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn version_handler_sets_no_store_cache_control() {
        let response = version_handler().await.into_response();

        assert_eq!(
            response.headers().get(CACHE_CONTROL),
            Some(&HeaderValue::from_static("no-store"))
        );

        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let info: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(!info["version"].as_str().unwrap_or("").is_empty());
        assert!(!info["gitHash"].as_str().unwrap_or("").is_empty());
        assert!(!info["buildTime"].as_str().unwrap_or("").is_empty());
    }
}
