use clap::Parser;
use serde::Deserialize;
use std::fmt;
use std::net::IpAddr;
use std::path::{Path, PathBuf};

#[derive(Parser, Debug)]
#[command(author, version, about = "DNS WebSocket API Backend")]
pub struct Cli {
    #[arg(short, long)]
    pub api_key: Option<String>,

    #[arg(short, long)]
    pub bind: Option<String>,

    #[arg(long)]
    pub ip: Option<String>,

    #[arg(short, long)]
    pub port: Option<u16>,

    #[arg(short, long)]
    pub config: Option<PathBuf>,

    /// Directory of built static web assets (when web serving is enabled).
    #[arg(long)]
    pub web_root: Option<PathBuf>,

    /// Disable static web serving; only `/ws` and `/version` remain.
    #[arg(long = "no-serve-web")]
    pub no_serve_web: bool,

    /// Cache-Control max-age (seconds) for served static web assets.
    #[arg(long)]
    pub static_cache_seconds: Option<u64>,

    /// Restrict per-request `dns_server` to the configured allowlist.
    #[arg(long)]
    pub secure_mode: bool,

    /// Upstream DNS server permitted in secure mode (repeatable).
    #[arg(long = "allowed-dns-server", action = clap::ArgAction::Append)]
    pub allowed_dns_servers: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct FileConfig {
    api_key: Option<String>,
    bind: Option<String>,
    ip: Option<String>,
    port: Option<u16>,
    web_root: Option<PathBuf>,
    serve_web: Option<bool>,
    static_cache_seconds: Option<u64>,
    secure_mode: Option<bool>,
    allowed_dns_servers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ConfigSource {
    Default,
    File,
    Environment,
    Cli,
}

impl ConfigSource {
    fn label(self) -> &'static str {
        match self {
            Self::Default => "defaults",
            Self::File => "config file",
            Self::Environment => "environment",
            Self::Cli => "CLI",
        }
    }
}

#[derive(Debug, Clone)]
struct Resolved<T> {
    value: T,
    source: ConfigSource,
    overridden: Vec<(ConfigSource, String)>,
}

fn format_value(value: &str, mask: bool) -> String {
    if mask {
        "(set)".to_string()
    } else {
        value.to_string()
    }
}

fn log_resolved<T: fmt::Display>(resolved: &Resolved<T>, name: &str, mask: bool) {
    let value = format_value(&resolved.value.to_string(), mask);

    if resolved.overridden.is_empty() {
        tracing::info!("{name} = {value} (source: {})", resolved.source.label());
        return;
    }

    let also = resolved
        .overridden
        .iter()
        .map(|(source, value)| format!("{}: {}", source.label(), format_value(value, mask)))
        .collect::<Vec<_>>()
        .join(", ");
    tracing::info!(
        "{name} = {value} (source: {}; overridden {also})",
        resolved.source.label()
    );
}

#[derive(Debug, Clone)]
pub struct ConfigReport {
    pub config_path: PathBuf,
    pub config_exists: bool,
    pub effective_bind: String,
}

impl ConfigReport {
    pub fn log_header(&self) {
        let status = if self.config_exists {
            "found"
        } else {
            "not found"
        };
        tracing::info!("Config file: {} ({status})", self.config_path.display());
        tracing::info!("Precedence: CLI > environment > config file > defaults");
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub api_key: String,
    pub bind: String,
    pub web_root: PathBuf,
    pub serve_web: bool,
    pub static_cache_seconds: u64,
    pub secure_mode: bool,
    pub allowed_dns_servers: Vec<IpAddr>,
    pub report: ConfigReport,
}

fn default_ip() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    8080
}

fn default_web_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../docs/app")
}

fn default_serve_web() -> bool {
    true
}

fn default_static_cache_seconds() -> u64 {
    600
}

fn env_var(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_port() -> Option<u16> {
    env_var("DNS_PORT").and_then(|value| value.parse().ok())
}

fn env_bind() -> Option<String> {
    env_var("DNS_BIND_ADDR").or_else(|| env_var("DNS_BIND"))
}

fn env_web_root() -> Option<PathBuf> {
    env_var("DNS_WEB_ROOT").map(PathBuf::from)
}

fn env_serve_web() -> Option<bool> {
    env_var("DNS_SERVE_WEB").and_then(parse_bool)
}

fn env_secure_mode() -> Option<bool> {
    env_var("DNS_SECURE_MODE").and_then(parse_bool)
}

fn env_static_cache_seconds() -> Option<u64> {
    env_var("DNS_STATIC_CACHE_SECONDS").and_then(|value| value.parse().ok())
}

fn split_csv_trimmed(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .collect()
}

fn env_allowed_dns_servers() -> Option<Vec<String>> {
    env_var("DNS_ALLOWED_DNS_SERVERS").map(|value| split_csv_trimmed(&value))
}

fn parse_ip_list(entries: &[String]) -> Result<Vec<IpAddr>, config::ConfigError> {
    entries
        .iter()
        .map(|entry| {
            entry.parse::<IpAddr>().map_err(|_| {
                tracing::error!("allowed_dns_servers: invalid IP address \"{entry}\"");
                config::ConfigError::Message(format!(
                    "allowed_dns_servers: invalid IP address \"{entry}\""
                ))
            })
        })
        .collect()
}

fn require_allowed_servers_when_secure(
    secure_mode: bool,
    allowed_dns_servers: &[IpAddr],
) -> Result<(), config::ConfigError> {
    if secure_mode && allowed_dns_servers.is_empty() {
        tracing::error!(
            "secure_mode is enabled but allowed_dns_servers is empty; at least one allowed DNS server is required"
        );
        return Err(config::ConfigError::Message(
            "secure_mode requires at least one entry in allowed_dns_servers".to_string(),
        ));
    }
    Ok(())
}

fn parse_bool(value: String) -> Option<bool> {
    match value.to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

fn load_file_config(path: &Path) -> Result<FileConfig, config::ConfigError> {
    config::Config::builder()
        .add_source(config::File::from(path))
        .build()?
        .try_deserialize()
}

fn resolve_string(
    cli: Option<String>,
    env: Option<String>,
    file: Option<String>,
    default: Option<String>,
) -> Option<Resolved<String>> {
    let candidates = [
        (ConfigSource::Cli, cli),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value));
        } else {
            winner = Some((source, value));
        }
    }

    let (source, value) = winner.or_else(|| default.map(|value| (ConfigSource::Default, value)))?;

    Some(Resolved {
        value,
        source,
        overridden,
    })
}

fn resolve_bool(
    cli: Option<bool>,
    env: Option<bool>,
    file: Option<bool>,
    default: bool,
) -> Resolved<bool> {
    let candidates = [
        (ConfigSource::Cli, cli),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value.to_string()));
        } else {
            winner = Some((source, value));
        }
    }

    let (source, value) = winner.unwrap_or((ConfigSource::Default, default));
    Resolved {
        value,
        source,
        overridden,
    }
}

fn resolve_list(
    cli: Vec<String>,
    env: Option<Vec<String>>,
    file: Option<Vec<String>>,
) -> Resolved<Vec<String>> {
    let candidates = [
        (ConfigSource::Cli, (!cli.is_empty()).then_some(cli)),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value.join(",")));
        } else {
            winner = Some((source, value));
        }
    }

    let (source, value) = winner.unwrap_or((ConfigSource::Default, Vec::new()));
    Resolved {
        value,
        source,
        overridden,
    }
}

fn resolve_path(
    cli: Option<PathBuf>,
    env: Option<PathBuf>,
    file: Option<PathBuf>,
    default: PathBuf,
) -> Resolved<PathBuf> {
    let candidates = [
        (ConfigSource::Cli, cli),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value.display().to_string()));
        } else {
            winner = Some((source, value));
        }
    }

    let (source, value) = winner.unwrap_or((ConfigSource::Default, default));
    Resolved {
        value,
        source,
        overridden,
    }
}

fn resolve_port(
    cli: Option<u16>,
    env: Option<u16>,
    file: Option<u16>,
    default: u16,
) -> Resolved<u16> {
    let candidates = [
        (ConfigSource::Cli, cli),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value.to_string()));
        } else {
            winner = Some((source, value));
        }
    }

    let (source, value) = winner.unwrap_or((ConfigSource::Default, default));
    Resolved {
        value,
        source,
        overridden,
    }
}

fn resolve_u64(
    cli: Option<u64>,
    env: Option<u64>,
    file: Option<u64>,
    default: u64,
) -> Resolved<u64> {
    let candidates = [
        (ConfigSource::Cli, cli),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value.to_string()));
        } else {
            winner = Some((source, value));
        }
    }

    let (source, value) = winner.unwrap_or((ConfigSource::Default, default));
    Resolved {
        value,
        source,
        overridden,
    }
}

fn resolve_bind(
    cli: Option<String>,
    env: Option<String>,
    file: Option<String>,
) -> Option<Resolved<String>> {
    let candidates = [
        (ConfigSource::Cli, cli),
        (ConfigSource::Environment, env),
        (ConfigSource::File, file),
    ];

    let mut winner = None;
    let mut overridden = Vec::new();

    for (source, value) in candidates {
        let Some(value) = value else {
            continue;
        };

        if winner.is_some() {
            overridden.push((source, value));
        } else {
            winner = Some((source, value));
        }
    }

    winner.map(|(source, value)| Resolved {
        value,
        source,
        overridden,
    })
}

fn default_config_path() -> PathBuf {
    let config_home = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))
        })
        .unwrap_or_else(|| PathBuf::from(".config"));

    config_home.join("webdns").join("config.toml")
}

impl AppConfig {
    pub fn load() -> Result<Self, config::ConfigError> {
        let cli = Cli::parse();

        let config_path = cli
            .config
            .clone()
            .unwrap_or_else(default_config_path);
        let config_exists = config_path.exists();

        let report = ConfigReport {
            config_path: config_path.clone(),
            config_exists,
            effective_bind: String::new(),
        };
        report.log_header();

        let file = if config_exists {
            load_file_config(&config_path)?
        } else {
            FileConfig::default()
        };

        let bind_override = resolve_bind(cli.bind.clone(), env_bind(), file.bind.clone());
        if let Some(bind) = &bind_override {
            log_resolved(bind, "bind", false);
        }

        let api_key = resolve_string(
            cli.api_key.clone(),
            env_var("DNS_API_KEY"),
            file.api_key.clone(),
            None,
        );
        let Some(api_key) = api_key else {
            tracing::error!("api_key: not set (checked CLI, environment, config file)");
            return Err(config::ConfigError::NotFound("api_key".to_string()));
        };
        log_resolved(&api_key, "api_key", true);

        let ip = resolve_string(
            cli.ip.clone(),
            env_var("DNS_IP"),
            file.ip.clone(),
            Some(default_ip()),
        )
        .expect("ip always resolves via default");
        if bind_override.is_none() {
            log_resolved(&ip, "ip", false);
        }

        let port = resolve_port(cli.port, env_port(), file.port, default_port());
        if bind_override.is_none() {
            log_resolved(&port, "port", false);
        }

        let cli_serve_web = if cli.no_serve_web {
            Some(false)
        } else {
            None
        };
        let serve_web = resolve_bool(
            cli_serve_web,
            env_serve_web(),
            file.serve_web,
            default_serve_web(),
        );
        log_resolved(&serve_web, "serve_web", false);

        let web_root = resolve_path(
            cli.web_root,
            env_web_root(),
            file.web_root,
            default_web_root(),
        );

        if web_root.overridden.is_empty() {
            tracing::info!(
                "web_root = {} (source: {})",
                web_root.value.display(),
                web_root.source.label()
            );
        } else {
            let also = web_root
                .overridden
                .iter()
                .map(|(source, value)| format!("{}: {value}", source.label()))
                .collect::<Vec<_>>()
                .join(", ");
            tracing::info!(
                "web_root = {} (source: {}; overridden {also})",
                web_root.value.display(),
                web_root.source.label()
            );
        }

        if serve_web.value && !web_root.value.exists() {
            tracing::warn!(
                "web_root does not exist: {} (static files will 404 until it is present)",
                web_root.value.display()
            );
        }

        let static_cache_seconds = resolve_u64(
            cli.static_cache_seconds,
            env_static_cache_seconds(),
            file.static_cache_seconds,
            default_static_cache_seconds(),
        );
        log_resolved(&static_cache_seconds, "static_cache_seconds", false);

        let secure_mode = resolve_bool(
            if cli.secure_mode { Some(true) } else { None },
            env_secure_mode(),
            file.secure_mode,
            false,
        );
        log_resolved(&secure_mode, "secure_mode", false);

        let allowed_dns_servers_raw = resolve_list(
            cli.allowed_dns_servers.clone(),
            env_allowed_dns_servers(),
            file.allowed_dns_servers.clone(),
        );

        let allowed_dns_servers = parse_ip_list(&allowed_dns_servers_raw.value)?;
        tracing::info!(
            "allowed_dns_servers = [{}] (source: {})",
            allowed_dns_servers
                .iter()
                .map(|ip| ip.to_string())
                .collect::<Vec<_>>()
                .join(", "),
            allowed_dns_servers_raw.source.label()
        );

        require_allowed_servers_when_secure(secure_mode.value, &allowed_dns_servers)?;

        let effective_bind = bind_override
            .as_ref()
            .map(|bind| bind.value.clone())
            .unwrap_or_else(|| format!("{}:{}", ip.value, port.value));

        if bind_override.is_some() {
            tracing::info!(
                "listen address = {} (source: {})",
                effective_bind,
                bind_override
                    .as_ref()
                    .expect("bind override present")
                    .source
                    .label()
            );
        } else {
            tracing::info!(
                "listen address = {} (computed from ip + port)",
                effective_bind
            );
        }

        let report = ConfigReport {
            config_path,
            config_exists,
            effective_bind: effective_bind.clone(),
        };

        Ok(Self {
            api_key: api_key.value,
            bind: effective_bind,
            web_root: web_root.value,
            serve_web: serve_web.value,
            static_cache_seconds: static_cache_seconds.value,
            secure_mode: secure_mode.value,
            allowed_dns_servers,
            report,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_csv_trimmed_drops_blanks_and_trims_whitespace() {
        assert_eq!(
            split_csv_trimmed(" 9.9.9.9 , 1.1.1.1,, 8.8.8.8 "),
            vec!["9.9.9.9", "1.1.1.1", "8.8.8.8"]
        );
    }

    #[test]
    fn parse_ip_list_accepts_valid_addresses() {
        let entries = vec!["9.9.9.9".to_string(), "::1".to_string()];
        let parsed = parse_ip_list(&entries).unwrap();
        assert_eq!(
            parsed,
            vec![
                "9.9.9.9".parse::<IpAddr>().unwrap(),
                "::1".parse::<IpAddr>().unwrap()
            ]
        );
    }

    #[test]
    fn parse_ip_list_rejects_invalid_address() {
        let entries = vec!["not-an-ip".to_string()];
        let err = parse_ip_list(&entries).unwrap_err();
        assert!(err.to_string().contains("not-an-ip"));
    }

    #[test]
    fn require_allowed_servers_when_secure_fails_on_empty_list() {
        let err = require_allowed_servers_when_secure(true, &[]).unwrap_err();
        assert!(err.to_string().contains("allowed_dns_servers"));
    }

    #[test]
    fn require_allowed_servers_when_secure_passes_with_entries() {
        let allowed = vec!["9.9.9.9".parse().unwrap()];
        assert!(require_allowed_servers_when_secure(true, &allowed).is_ok());
    }

    #[test]
    fn require_allowed_servers_when_secure_ignored_when_disabled() {
        assert!(require_allowed_servers_when_secure(false, &[]).is_ok());
    }

    #[test]
    fn resolve_u64_falls_back_to_default_static_cache_seconds() {
        let resolved = resolve_u64(None, None, None, default_static_cache_seconds());
        assert_eq!(resolved.value, 600);
        assert_eq!(resolved.source, ConfigSource::Default);
    }

    #[test]
    fn resolve_u64_prefers_cli_over_env_and_file() {
        let resolved = resolve_u64(Some(3600), Some(60), Some(120), default_static_cache_seconds());
        assert_eq!(resolved.value, 3600);
        assert_eq!(resolved.source, ConfigSource::Cli);
    }

    #[test]
    fn resolve_u64_falls_back_to_env_then_file() {
        let resolved = resolve_u64(None, Some(60), Some(120), default_static_cache_seconds());
        assert_eq!(resolved.value, 60);
        assert_eq!(resolved.source, ConfigSource::Environment);
    }
}
