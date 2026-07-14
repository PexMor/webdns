## 1. Config: secure mode and allowlist

- [x] 1.1 Add `secure_mode: bool` and `allowed_dns_servers: Vec<String>` to `Cli` in `dns-backend/src/config.rs` (`--secure-mode` boolean flag, repeatable `--allowed-dns-server`)
- [x] 1.2 Add `secure_mode: Option<bool>` and `allowed_dns_servers: Option<Vec<String>>` to `FileConfig` (TOML `secure_mode`, `allowed_dns_servers`)
- [x] 1.3 Add `env_secure_mode()` (`DNS_SECURE_MODE`, reuse `parse_bool`) and `env_allowed_dns_servers()` (`DNS_ALLOWED_DNS_SERVERS`, comma-separated, trimmed, empty entries dropped)
- [x] 1.4 Resolve `secure_mode` and `allowed_dns_servers` in `AppConfig::load()` using CLI > env > TOML > default precedence (default `false` / empty list), following the existing `resolve_bool`/list pattern
- [x] 1.5 Validate each `allowed_dns_servers` entry parses as `std::net::IpAddr`; on failure, log an error identifying the bad entry and return `Err(config::ConfigError::...)` so startup fails
- [x] 1.6 If `secure_mode` is `true` and the resolved `allowed_dns_servers` is empty, log an error and fail startup
- [x] 1.7 Add `secure_mode: bool` and `allowed_dns_servers: Vec<IpAddr>` fields to `AppConfig` and log both at startup (mirroring `log_resolved`/`serve_web` style)

## 2. Resolver enforcement

- [x] 2.1 Extend `ResolverCache::new` to accept `secure_mode: bool` and `allowed_dns_servers: &[IpAddr]`, storing them on the struct
- [x] 2.2 When `secure_mode` is true and no `default` resolver has been pre-built for the first allowed server, build it from `allowed_dns_servers[0]` instead of the hardcoded `DEFAULT_DNS`
- [x] 2.3 Update `ResolverCache::get` so that when `secure_mode` is true: a missing `dns_server` resolves to the first allowed server, and a present `dns_server` not contained in `allowed_dns_servers` returns `Err("DNS server <ip> is not permitted in secure mode.")` without building/caching a resolver for it
- [x] 2.4 Confirm `secure_mode = false` path is unchanged (existing tests in `dns-backend/src/dns.rs` continue to pass unmodified)
- [x] 2.5 Update the `ResolverCache::new()` call site (`AppState`/`main.rs`) to pass `state.config.secure_mode` and `state.config.allowed_dns_servers`

## 3. Tests

- [x] 3.1 Unit test: `secure_mode = true`, request with `dns_server` in the allowlist resolves successfully
- [x] 3.2 Unit test: `secure_mode = true`, request with `dns_server` not in the allowlist returns the expected `Err` message and does not build a resolver
- [x] 3.3 Unit test: `secure_mode = true`, request with no `dns_server` uses the first allowlisted server
- [x] 3.4 Unit test: `secure_mode = false` behavior is unchanged (any valid IP accepted, default remains `1.1.1.1`)
- [x] 3.5 Config test: startup fails when `secure_mode = true` and `allowed_dns_servers` is empty
- [x] 3.6 Config test: startup fails when `allowed_dns_servers` contains an invalid IP string
- [x] 3.7 Config test: `DNS_ALLOWED_DNS_SERVERS` env var is parsed correctly (comma-separated, trimmed)

## 4. Docs

- [x] 4.1 Document `secure_mode` / `allowed_dns_servers` (CLI flags, env vars, TOML keys, defaults, and the rejection behavior) in the backend README/config docs
