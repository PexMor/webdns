## Why

We have a blueprint for a Rust/axum WebSocket backend that resolves DNS records, but no runnable app: no crate scaffold, no frontend, no way for a user to actually type a domain and see results. Turning the blueprint into an app means shipping a working backend plus a minimal web client (PWA) that talks to it over WebSocket, so a user can query DNS records (A/AAAA/MX/TXT/etc.) interactively from a browser.

## What Changes

- Scaffold the `dns-backend` Rust binary crate (Cargo.toml, module layout) implementing the blueprint: layered config (CLI > env > TOML) via `clap` + `config`, DNS resolution via `hickory-resolver`, and a WebSocket API via `axum`.
- Implement the `/ws` WebSocket endpoint: API-key check via query param, JSON request/response protocol (`{domain, record_types}` → per-record-type results with errors surfaced per type, not per request).
- Implement concurrent-per-record-type resolution so one slow/failing record type doesn't block others.
- Add a static-file route (or embed) serving a minimal single-page web client (HTML/CSS/JS, installable as a PWA) that connects to `/ws`, submits domain + record type selections, and renders results live.
- Add structured logging (`tracing`) and CORS configuration suitable for the bundled web client.
- Add a default config file example and README covering how to run the backend and open the client.

## Capabilities

### New Capabilities
- `dns-resolver-backend`: Rust async backend that loads layered configuration, authenticates WebSocket clients via API key, and resolves one or more DNS record types per request, returning structured JSON results (including per-record-type errors).
- `dns-web-client`: Browser-based (PWA-capable) client that connects to the backend over WebSocket, lets a user submit a domain and choose record types, and displays streamed results.

### Modified Capabilities
(none — greenfield project, no existing specs)

## Impact

- **New code**: `dns-backend/` Rust crate (`src/main.rs`, `src/config.rs`, `src/dns.rs`), plus a `web/` (or `dns-backend/static/`) directory with the client (`index.html`, `app.js`, `manifest.json` for PWA installability).
- **Dependencies**: `tokio`, `axum` (ws feature), `tower-http` (cors), `hickory-resolver`, `serde`/`serde_json`, `clap` (derive, env), `config`, `futures-util`, `directories`, `tracing`/`tracing-subscriber`.
- **Config/deployment**: introduces `~/.config/dnsapi/config.toml` convention and `DNS_*` env vars; binds to a local address by default (`127.0.0.1:8080`).
- **Security**: API key is passed as a WebSocket query parameter — acceptable for a local/dev tool, called out explicitly as a constraint in design.md.
