## Why

The web client currently hardcodes the WebSocket URL from `location.host` and the backend hardcodes Cloudflare (1.1.1.1) as its upstream resolver. There is no way to point the app at alternate backends, choose which DNS server resolves queries, or inspect what version is running — all of which are essential for a tool meant to be deployed flexibly and debugged in the field.

## What Changes

- Add `webapp/public/config.json` as the runtime configuration source for WebSocket endpoint URLs (one or many, `ws://` / `wss://`) and default selectable DNS servers (8.8.8.8, 8.8.4.4, 1.1.1.1, plus the API server's local address).
- Extend the WebSocket request protocol so the client can specify which DNS server the backend should use for a query.
- Add a top-right hamburger menu housing settings (WS URL picker, DNS server picker, custom DNS server management) and an About dialog.
- Persist user-added DNS servers in IndexedDB with import/export (JSON file) for portability.
- Embed build metadata (app version, git commit hash, build datetime) in both the webapp and backend; surface it in the About dialog and as colored `console.log` output on startup (frontend) and server start (backend).

## Capabilities

### New Capabilities

- `webapp-runtime-config`: Load `config.json` at startup to populate WebSocket URL options and default DNS server list; fall back sensibly when the file is missing or malformed.
- `webapp-dns-server-prefs`: Manage user-defined DNS servers in IndexedDB with add/remove, import, and export.
- `build-version-info`: Produce and expose version, git hash, and build timestamp for both frontend and backend.

### Modified Capabilities

- `dns-web-client`: Add hamburger menu, settings panels, DNS server selection, WS URL selection, About dialog, and startup build-info logging.
- `dns-resolver-backend`: Accept per-request DNS server selection, expose a version/build-info HTTP endpoint, and log colored build metadata at startup.

## Impact

- **Webapp**: `public/config.json`, new modules for config loading, IndexedDB storage, settings/about UI, hamburger menu; changes to `useDnsSocket.js` and `app.jsx`; Vite build changes to inject frontend build metadata.
- **Backend**: `dns.rs` resolver construction becomes per-request or per-server-configurable; new `/version` (or similar) route; `build.rs` for git hash / build time embedding; WebSocket request schema gains optional `dns_server` field.
- **Protocol**: WebSocket JSON request shape extended (backward-compatible optional field).
- **Dependencies**: Possibly `idb` or raw IndexedDB API on frontend; `vergen` or manual `build.rs` on backend. No new runtime services.
