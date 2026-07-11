## 1. Runtime Configuration

- [x] 1.1 Create `webapp/public/config.json` with default `wsUrls` (same-origin `/ws`) and `dnsServers` (8.8.8.8, 8.8.4.4, 1.1.1.1, `"auto"`)
- [x] 1.2 Add `webapp/src/loadConfig.js` — fetch `/config.json`, validate schema, fall back to built-in defaults on error
- [x] 1.3 Implement relative WS URL resolution (path-only entries → full `ws://`/`wss://` URL from `location`)
- [x] 1.4 Implement `"auto"` DNS address resolution from selected WS URL host (fallback `127.0.0.1`)
- [x] 1.5 Persist selected WS URL and DNS server in `localStorage`; restore on load when still valid

## 2. Backend — Per-Request DNS Server

- [x] 2.1 Add optional `dns_server: Option<String>` to `DnsRequest` in `dns.rs`
- [x] 2.2 Implement resolver factory: build `TokioResolver` for a given IP (validate IPv4/IPv6 format); cache instances in `AppState` (HashMap capped ~20)
- [x] 2.3 Update `resolve_dns` to accept/use per-request resolver; default to 1.1.1.1 when field absent
- [x] 2.4 Return structured JSON error for invalid `dns_server` values without closing the WebSocket

## 3. Backend — Build Version Info

- [x] 3.1 Add `build.rs` embedding git hash and build datetime (via `vergen-gix` or manual git invocation)
- [x] 3.2 Add `GET /version` route returning `{ version, gitHash, buildTime }` JSON
- [x] 3.3 Log colored version/git/build-time on startup alongside bind address

## 4. Frontend — Build Version Info

- [x] 4.1 Add `webapp/scripts/generate-build-info.mjs` — write `src/build-info.json` from `package.json` version + git hash + ISO timestamp
- [x] 4.2 Wire `prebuild` (and dev) script in `package.json` to run generator
- [x] 4.3 Log colored build info in `main.jsx` on app startup via `%c` console styling

## 5. IndexedDB DNS Server Preferences

- [x] 5.1 Add `webapp/src/dnsServerStore.js` — IndexedDB wrapper (open DB, add/remove/list custom servers)
- [x] 5.2 Merge config defaults + IndexedDB custom servers into unified picker list (dedupe by address)
- [x] 5.3 Implement import: parse JSON file array, add new entries, skip duplicates, show summary
- [x] 5.4 Implement export: download JSON of custom servers only

## 6. WebSocket Client Updates

- [x] 6.1 Refactor `useDnsSocket.js` to accept configurable WS URL instead of hardcoded `location.host`
- [x] 6.2 Include `dns_server` in outgoing query messages when a DNS server is selected
- [x] 6.3 Reconnect when WS URL changes (close existing socket, open new one with stored API key)

## 7. Hamburger Menu UI

- [x] 7.1 Add top-right hamburger button and overlay menu panel (Settings, Manage DNS Servers, About)
- [x] 7.2 Build Settings panel: API key input, WS URL selector, DNS server selector
- [x] 7.3 Build Manage DNS Servers panel: add/remove custom servers, import/export buttons
- [x] 7.4 Build About dialog: display frontend build info + fetch/display backend `/version`
- [x] 7.5 Remove inline API key panel from main view; move connection settings into menu
- [x] 7.6 Style hamburger menu, panels, and About dialog in `style.css` (mobile-friendly, close on Escape/outside click)

## 8. Verification

- [x] 8.1 `yarn build` succeeds; `build-info.json` contains version, gitHash, buildTime
- [x] 8.2 `cargo build --release` succeeds; `GET /version` returns expected JSON
- [x] 8.3 App loads config.json defaults; WS URL and DNS server selectors populate correctly
- [x] 8.4 Query with DNS server 8.8.8.8 returns results distinct from 1.1.1.1 (or verify via backend logs)
- [x] 8.5 Add/import/export/remove custom DNS servers persists across page reload
- [x] 8.6 About dialog shows frontend and backend version info; console shows colored startup logs for both
- [x] 8.7 Hamburger menu opens/closes correctly; settings changes trigger reconnect; main query form still works end-to-end
