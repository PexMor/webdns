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

pub async fn version_handler() -> Json<VersionInfo> {
    Json(VersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_hash: env!("GIT_HASH").to_string(),
        build_time: env!("BUILD_TIME").to_string(),
    })
}
