## 1. Project Scaffold

- [x] 1.1 Run `cargo new dns-backend` and set up `Cargo.toml` with all dependencies (tokio, axum w/ ws, tower-http w/ cors + fs, hickory-resolver, serde/serde_json, clap w/ derive+env, config, futures-util, directories, tracing/tracing-subscriber)
- [x] 1.2 Create module layout: `src/main.rs`, `src/config.rs`, `src/dns.rs`, `src/ws.rs`

## 2. Configuration Layer

- [x] 2.1 Implement `Cli` struct (clap) with `--api-key`, `--bind`, `--config` flags and `DNS_*` env fallbacks
- [x] 2.2 Implement `AppConfig::load()` with precedence CLI > env > TOML > defaults, resolving default TOML path via `directories::ProjectDirs`
- [x] 2.3 Ensure missing required config (no api_key from any source) produces a clear startup error, not a panic with an empty key
- [x] 2.4 Add example `config.toml` and document `~/.config/dnsapi/config.toml` convention in README

## 3. DNS Resolution Core

- [x] 3.1 Implement `DnsRequest`/`DnsResponse`/`RecordResult` types (serde)
- [x] 3.2 Implement `resolve_dns` to resolve all requested record types **concurrently** (not sequentially as in the original blueprint sample), preserving input order in the output
- [x] 3.3 Handle unsupported record type strings as a per-entry error, not a request failure
- [x] 3.4 Handle per-record-type resolution errors (NXDOMAIN, timeout, etc.) as a per-entry error without failing the whole request

## 4. WebSocket API

- [x] 4.1 Implement `/ws` upgrade handler with API-key check via `apikey` query param, returning 401 on missing/invalid key
- [x] 4.2 Implement `handle_socket` to parse incoming JSON, call `resolve_dns`, and send back the serialized response
- [x] 4.3 On malformed JSON input, send a structured error message back on the same connection and keep the connection open
- [x] 4.4 Wire up `tracing_subscriber` init and log server bind address on startup, plus connection/error events

## 5. Static File Serving

- [x] 5.1 Add a `static/` (or `web/`) directory and mount it via `tower_http::services::ServeDir` alongside the `/ws` route
- [x] 5.2 Confirm CORS policy is appropriate for same-origin serving (keep permissive for now per design.md)

## 6. Web Client (PWA)

- [x] 6.1 Build `index.html` with a form: domain input + checkboxes for A/AAAA/MX/TXT/CNAME/NS record types
- [x] 6.2 Implement `app.js`: open WebSocket to `/ws?apikey=...`, submit query on form submit, block submission when no record type is selected
- [x] 6.3 Render results grouped by record type; show inline error state for record types with an `error` field without hiding successful ones
- [x] 6.4 Add visible connection-state UI (connecting / connected / error) so a failed connection or bad API key isn't silent
- [x] 6.5 Add `manifest.json` (name, icons, start_url, display: standalone) and a minimal service worker caching the app shell for offline load
- [x] 6.6 Register the service worker and link the manifest from `index.html`

## 7. Verification

- [x] 7.1 `cargo run` with only a TOML config file present; confirm server starts and binds to configured address
- [x] 7.2 Override with `DNS_API_KEY`/`DNS_BIND_ADDR` env vars and confirm precedence over TOML
- [x] 7.3 Override with `--api-key`/`--bind` CLI flags and confirm precedence over env and TOML
- [x] 7.4 From the served web client, query a real domain with multiple record types (e.g., A, AAAA, MX, TXT) and confirm concurrent resolution and correct per-type results/errors render
- [x] 7.5 Verify wrong/missing `apikey` on the WebSocket connection is rejected (401) both from a raw client and from the web UI's connection-state indicator
- [x] 7.6 Verify the app installs as a PWA (manifest + service worker recognized by the browser) and the shell loads offline

## 8. Vite/Preact Migration

- [x] 8.1 Scaffold `webapp/` as a standalone Yarn Berry (v4, via Corepack) project (`packageManager` field, `.yarnrc.yml` with `nodeLinker: node-modules`, own `yarn.lock`)
- [x] 8.2 Add Vite + `@preact/preset-vite` + `vite-plugin-pwa` and configure `vite.config.js` (dev `/ws` proxy, PWA manifest generation)
- [x] 8.3 Port the vanilla-JS client into Preact: `useDnsSocket` hook (connection/query state) and `App` component (API key panel, query form, results, connection status)
- [x] 8.4 Port `style.css` and icons into `webapp/src` and `webapp/public/icons`
- [x] 8.5 `yarn build` produces `webapp/dist/` including generated `manifest.webmanifest` and service worker
- [x] 8.6 Repoint `dns-backend`'s `ServeDir` from `static/` to `webapp/dist/` (resolved via `CARGO_MANIFEST_DIR` so it's independent of `cargo run`'s working directory) and delete the old `dns-backend/static/`
- [x] 8.7 Re-verify end-to-end in a headless browser: manifest loads, service worker activates, connect + query flow renders results, offline reload still serves the cached shell
