## Context

The webapp (`webapp/`, Preact + Vite PWA) connects to the Rust backend over WebSocket at `/ws`, deriving the URL from `location.host`. The backend uses a single hardcoded Cloudflare resolver (`CLOUDFLARE` in `dns.rs`). There is no runtime configuration file, no user settings UI beyond inline API-key entry, and no build/version metadata exposed to operators.

This change makes the app deployable against multiple backends, lets users pick upstream DNS resolvers, and surfaces version info for support and debugging.

## Goals / Non-Goals

**Goals:**

- Load `webapp/public/config.json` at app startup for WebSocket URLs and default DNS servers.
- Allow selecting WS URL (when multiple configured) and DNS server (defaults + user-added).
- Persist custom DNS servers in IndexedDB with JSON import/export.
- Top-right hamburger menu for settings, DNS management, and About dialog.
- Per-request DNS server selection sent to backend over existing WebSocket protocol.
- Build metadata (version, git hash, build datetime) embedded at build time for frontend and backend; shown in About dialog and logged in color on startup.

**Non-Goals:**

- No server-side persistence of user preferences (IndexedDB is client-only).
- No DNS-over-HTTPS/TLS upstream — plain UDP/TCP to IP addresses only.
- No automatic discovery of backends (URLs come from config.json or user selection).
- No changes to API-key auth model or PWA offline behavior beyond loading config from cache when offline.

## Decisions

### 1. `config.json` schema and loading

```json
{
  "wsUrls": ["ws://127.0.0.1:8080/ws", "wss://dns.example.com/ws"],
  "dnsServers": [
    { "label": "Google Primary", "address": "8.8.8.8" },
    { "label": "Google Secondary", "address": "8.8.4.4" },
    { "label": "Cloudflare", "address": "1.1.1.1" },
    { "label": "Local API Server", "address": "auto" }
  ]
}
```

- **`wsUrls`**: Array of full WebSocket URLs including path (`/ws`). When empty or missing, fall back to current behavior: `${protocol}://${location.host}/ws`.
- **`dnsServers`**: Array of `{label, address}`. Address `"auto"` is resolved at runtime to the hostname/IP of the currently selected WS URL (without port), falling back to `127.0.0.1` for localhost URLs.
- Loaded via `fetch('/config.json')` before first connect. On fetch failure, use built-in defaults matching the schema above (single same-origin WS URL + the four default DNS entries).
- Selected WS URL and DNS server persisted in `localStorage` (keys `dns_ws_url`, `dns_server_address`) so choices survive reloads.

*Alternative considered*: Environment variables at Vite build time — rejected because the goal is deploy-time config without rebuild.

### 2. WebSocket protocol extension

Add optional `dns_server` field to the request:

```json
{ "domain": "example.com", "record_types": ["A"], "dns_server": "8.8.8.8" }
```

- Backend builds (or reuses cached) a `TokioResolver` for the given IP on each request. Invalid IP → per-request error in response (same shape as record-type errors) or a top-level `{ "error": "..." }` for malformed server address.
- Omitting `dns_server` preserves current behavior (use backend default: first entry from config or 1.1.1.1).
- Backward compatible: existing clients without the field continue to work.

*Alternative considered*: Separate WebSocket subprotocol per DNS server — rejected as over-engineered.

### 3. IndexedDB for custom DNS servers

- Database: `webdns`, store: `customDnsServers`, key: `address` (unique IP string).
- Record shape: `{ address: string, label?: string, addedAt: string }`.
- Merged with `config.json` defaults in the DNS server picker (defaults first, then custom, deduplicated by address).
- Import: accept JSON array of `{ address, label? }`; merge without overwriting existing entries; report count added/skipped.
- Export: download JSON file of all custom (non-config-default) servers.

Raw IndexedDB API — no `idb` dependency — keeps bundle small for this small dataset.

### 4. Hamburger menu UI

- Fixed top-right `☰` button opening a dropdown/drawer panel.
- Menu items: **Settings** (WS URL + DNS server pickers, API key), **Manage DNS Servers** (add/remove/import/export), **About** (version info for frontend + backend).
- Settings currently inline in the main view (API key panel) move into the menu/settings panel to declutter the main query form.
- Mobile-friendly: menu overlays content, closes on outside click or Escape.

### 5. Build version info

**Frontend** (Vite):

- Small `scripts/generate-build-info.mjs` run as `prebuild` (and optionally during `dev`) writing `src/build-info.json`:
  `{ "version": "<from package.json>", "gitHash": "<short hash or 'unknown'>", "buildTime": "<ISO8601 UTC>" }`
- Git hash via `git rev-parse --short HEAD` (graceful `"unknown"` if not a git repo).
- Import in `main.jsx`; log with `%c` styled `console.log` on startup.
- About dialog reads the same object; also fetches backend version from `GET /version`.

**Backend** (Rust):

- `build.rs` using `vergen-gix` (or lightweight manual: `option_env!("GIT_HASH")` set in build script) to expose `env!("VERGEN_GIT_SHA")` / custom constants.
- New route `GET /version` returning JSON: `{ "version": "0.1.0", "gitHash": "abc1234", "buildTime": "2026-07-10T06:00:00Z" }`.
- Startup `tracing::info!` with ANSI colors (already available via `tracing-subscriber`) logging the same triple.

*Alternative considered*: Embed version only in frontend — rejected; user explicitly wants both sides visible.

### 6. Backend `/version` and CORS

- Public, unauthenticated JSON endpoint (no API key) — version info is not sensitive.
- Same-origin when served together; CORS already permissive.

## Risks / Trade-offs

- [Per-request resolver construction is slower] → Cache resolvers in a `HashMap<String, Arc<TokioResolver>>` behind a mutex/RwLock in `AppState`; evict LRU or cap at ~20 entries.
- [Invalid DNS server IP causes query failures] → Validate IPv4/IPv6 format client-side before send; backend returns clear error for unreachable resolvers.
- [`config.json` cached by service worker] → Document that config changes may require hard refresh; PWA SW uses network-first for `/config.json` if feasible in vite-plugin-pwa config.
- [Build info stale in dev] → Regenerate `build-info.json` on `vite` dev start or accept `"dev"` placeholder for `buildTime` in development mode.

## Migration Plan

1. Ship `config.json` with sensible defaults (same-origin WS + four DNS servers).
2. Deploy backend with extended protocol (optional field — no breaking change).
3. Deploy frontend; existing localStorage API keys continue to work.
4. No database migration needed (IndexedDB created on first use).

Rollback: revert frontend/backend; old clients ignore unknown request fields; new clients against old backend simply omit `dns_server`.

## Open Questions

- Should the backend default DNS server list also be configurable via TOML? **Deferred** — client-side config.json covers the primary use case; backend TOML defaults can follow if needed.
- Should WS URL list support relative paths (e.g. `/ws` only)? **Yes** — treat paths without scheme/host as relative to `location.host`.
