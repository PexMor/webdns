## 1. Backend WebSocket auth

- [x] 1.1 Add helper to extract API key from upgrade request: `apikey` query param, then `X-API-Key`, `Authorization` (strip `Bearer `), `apikey` header
- [x] 1.2 Update `ws_handler` in `dns-backend/src/ws.rs` to use the helper; return 401 when no valid key matches `state.config.api_key`
- [x] 1.3 Add unit or integration test covering query-param auth, `X-API-Key` header auth, and `Authorization: Bearer` auth

## 2. Header store (IndexedDB)

- [x] 2.1 Create `webapp/src/wsHeaderStore.js` with get/set/list/add/update/remove for `wsConnectionHeaders` in prefs store
- [x] 2.2 Implement `migrateLegacyApiKey()` — synthesize builtin `apikey` row from existing `apiKey` pref when header list is empty
- [x] 2.3 Implement `exportWsHeaders()` and `importWsHeaders(json, { merge: true })` returning added/updated counts
- [x] 2.4 Keep `apiKeyStore.js` API key save in sync with builtin `apikey` header row (dual-write on set/clear)

## 3. Config and URL encoding

- [x] 3.1 Extend `loadConfig.js` to parse optional `wsConnectionHeaders` defaults and `wsHeaderQueryMap` from `config.json`
- [x] 3.2 Add `buildWsUrlWithHeaders(baseUrl, headers, queryMap)` — append enabled headers as query params per mapping rules
- [x] 3.3 Document optional `wsHeaderQueryMap` / `wsConnectionHeaders` fields in `webapp/public/config.json` example

## 4. WebSocket hook integration

- [x] 4.1 Refactor `useDnsSocket.js` to load connection headers from `wsHeaderStore` instead of only `apiKeyRef`
- [x] 4.2 Use `buildWsUrlWithHeaders` when opening socket; require at least one enabled credential (e.g. `apikey`) before connect
- [x] 4.3 Expose `saveConnectionHeaders(headers)` and `reconnect()` callbacks; trigger reconnect when headers change
- [x] 4.4 Update connection error labels to mention credentials/headers, not only API key

## 5. Settings UI

- [x] 5.1 Add Connection headers section to Settings panel in `menu.jsx`: list with name, masked value, enabled toggle, remove
- [x] 5.2 Add form to create new header (name + value); validate non-empty name
- [x] 5.3 Wire Import JSON / Export JSON buttons (file picker + download) with success/error messages
- [x] 5.4 Add browser-limitation hint text per spec (query-param carrier, proxy mapping)
- [x] 5.5 Integrate existing API key input as shortcut that upserts builtin `apikey` header and reconnects
- [x] 5.6 Add styles in `style.css` for header list, masked values, and import/export row

## 6. App wiring

- [x] 6.1 Load connection headers in `app.jsx` on startup; pass to `useDnsSocket` and Settings panel
- [x] 6.2 On header save/import, refresh header state and trigger socket reconnect
- [x] 6.3 Merge `config.json` default headers into UI when user store is empty (read-only suggestions)

## 7. Verification

- [x] 7.1 Manual test: connect with builtin `apikey` only (backward compatible)
- [x] 7.2 Manual test: add `Authorization` header, confirm query param on WS URL and successful connect via proxy or direct backend header path
- [x] 7.3 Manual test: import/export round-trip preserves headers
- [x] 7.4 Manual test: legacy `apiKey` IndexedDB entry migrates on first load
- [x] 7.5 Manual test: disabled header omitted from URL; changing headers triggers reconnect
