## Context

`dns-backend/src/dns.rs` owns a `ResolverCache` that lazily builds and caches a `TokioResolver` per requested IP, with no restriction on which IP a client may request via the WebSocket `dns_server` field. `dns-backend/src/config.rs` already implements a layered (CLI > env > TOML > default) config pattern for other settings (`api_key`, `bind`, `web_root`, `serve_web`) that this change should follow for consistency. `dns-backend/src/ws.rs` already has a generic error path: any `Err(String)` returned from `ResolverCache::get` becomes a JSON `{"error": ...}` message sent back to the client, with the connection kept open — this change reuses that path rather than inventing a new one.

## Goals / Non-Goals

**Goals:**
- Let an operator lock a deployment to a fixed, explicit set of upstream DNS servers via config.
- Enforce the allowlist entirely server-side; a compromised or malicious frontend cannot bypass it.
- Fail fast at startup on a nonsensical configuration (`secure_mode = true` with an empty or invalid allowlist) rather than failing per-request at runtime.
- Preserve today's unrestricted behavior when `secure_mode` is off (the default).

**Non-Goals:**
- No changes to the webapp/frontend. It keeps sending whatever `dns_server` the user configured; the backend is the sole enforcement point.
- No support for hostnames or DoH/DoT URLs in `allowed_dns_servers` — same IP-only model as the existing `dns_server` field.
- No per-API-key or per-client allowlists; `secure_mode` and `allowed_dns_servers` are global, process-wide settings.
- No dynamic/runtime reload of the allowlist; it is fixed for the lifetime of the process, consistent with other config values.

## Decisions

- **Config shape**: add `secure_mode: bool` (default `false`) and `allowed_dns_servers: Vec<String>` (default empty) to `AppConfig`, sourced with the same CLI > env > TOML > default precedence as existing fields.
  - CLI: `--secure-mode` (boolean flag) and repeatable `--allowed-dns-server <IP>` (clap `ArgAction::Append`, producing `Vec<String>`).
  - Env: `DNS_SECURE_MODE` (parsed with the existing `parse_bool` truthy/falsy set) and `DNS_ALLOWED_DNS_SERVERS` (comma-separated IPs, split/trimmed like other list-shaped env vars would be).
  - TOML: `secure_mode = true` and `allowed_dns_servers = ["1.1.1.1", "9.9.9.9"]`.
  - Rationale: mirrors the existing `serve_web`/`web_root` pattern exactly, so operators reading the current config already understand the shape.
  - Alternative considered: CIDR ranges instead of exact IPs. Rejected as unnecessary scope creep — the existing `dns_server` field is a single exact IP, so the allowlist only needs to match exact IPs.
- **Validation at load time**: parse every `allowed_dns_servers` entry as `std::net::IpAddr` during `AppConfig::load()`; an unparseable entry is a startup error (same style as the existing missing-`api_key` failure). If `secure_mode` is `true` and the resulting list is empty, startup also fails with a clear error, since no request could ever succeed.
  - Rationale: catching this at boot is far cheaper to debug than discovering it from a wall of per-request "not permitted" errors in production.
- **Enforcement point**: `ResolverCache` gains the allowlist and secure-mode flag at construction (`ResolverCache::new(default_dns, secure_mode, allowed_ips)`), not as a per-call parameter. `ResolverCache::get(dns_server)` is extended so that when `secure_mode` is true:
  - a request with no `dns_server` uses the *first* entry of `allowed_dns_servers` as the effective default (replacing the hardcoded `1.1.1.1`), since `1.1.1.1` may not even be on the operator's allowlist;
  - a request with a `dns_server` not present (by exact `IpAddr` equality) in `allowed_dns_servers` returns `Err("DNS server <ip> is not permitted in secure mode.")` instead of building/using a resolver for it.
  - When `secure_mode` is false, behavior is byte-for-byte what it is today.
  - Rationale: keeping the allowlist inside `ResolverCache` keeps `ws.rs` untouched — it already treats any `Err(String)` from `.get()` as a client-facing JSON error and keeps the connection open, which is exactly the desired "ignored and triggers an error response" behavior from the proposal.
  - Alternative considered: enforce the allowlist in `ws.rs` before calling `resolvers.get()`. Rejected because it duplicates the "what's the effective server" logic (default substitution) that `ResolverCache` already owns, and splits validation across two files for no benefit.
- **Logging**: log resolved `secure_mode` and `allowed_dns_servers` at startup via the existing `log_resolved`/`tracing::info!` conventions, so `secure_mode = true` with its allowlist is visible in the same startup log block as `bind`, `serve_web`, etc.

## Risks / Trade-offs

- [Operator sets `secure_mode = true` but forgets to update `allowed_dns_servers` after rotating upstream resolvers] → Mitigated by the startup log line showing the effective allowlist every time the process starts, and by fast, explicit per-request error messages (not silent fallback) so the failure mode is loud rather than a confusing default-resolver substitution.
- [Startup fails hard when `secure_mode = true` and the allowlist is empty/invalid] → Intentional; this is a config error, and failing fast is consistent with how the existing missing-`api_key` case is already handled.
- [`ResolverCache` constructor signature changes] → Contained to `dns-backend/src/dns.rs` and the single call site in `main.rs`/`AppState` construction; not a public crate API, so no external breakage.

## Migration Plan

- Purely additive/opt-in: existing deployments with no `secure_mode`/`allowed_dns_servers` config keep today's unrestricted behavior (`secure_mode` defaults to `false`).
- Operators who want to enable secure mode add `secure_mode = true` and `allowed_dns_servers = [...]` to their TOML (or equivalent CLI/env), redeploy, and confirm the startup log shows the expected allowlist before relying on it.
- No data migration; no rollback beyond removing/unsetting `secure_mode`.

## Open Questions

- None outstanding; the proposal's intent (hard reject of out-of-allowlist servers, no silent fallback) fully determines the enforcement behavior above.
