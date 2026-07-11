## Why

The webapp authenticates to the backend by appending a single `apikey` query parameter on the WebSocket URL. Deployments behind reverse proxies or API gateways often require credentials in HTTP headers (for example `Authorization`, `X-API-Key`, or custom gateway headers). Operators need a way to configure and persist those credentials without rebuilding the app, and the current single-field API key UI cannot express multi-header auth setups.

## What Changes

- Add a **Connection headers** section in the hamburger menu Settings panel where users can define extra key-value pairs used when opening the WebSocket.
- Persist connection headers in IndexedDB (same `preferences` store pattern as the API key), with add, edit, remove, import, and export (JSON).
- Apply stored headers on every WebSocket connect and reconnect (including after URL changes).
- Support optional default header definitions in `config.json` (merged with user overrides; user values win on conflict).
- Fold the existing API key field into the header system as a built-in `apikey` mapping while keeping backward compatibility for stored keys.
- Extend the backend WebSocket upgrade handler to accept the configured API key from HTTP headers in addition to the `apikey` query parameter (so proxies that inject or forward headers work without query-string auth).
- Document the browser limitation: the native WebSocket API cannot set arbitrary HTTP headers on the handshake; the client SHALL encode configured headers as query parameters (with configurable name mapping) so reverse proxies can translate them to real headers.

## Capabilities

### New Capabilities

- `ws-connection-headers`: User-managed, persisted WebSocket connection header key-value pairs; import/export; application at connect time; optional `config.json` defaults and query-param mapping for browser compatibility.

### Modified Capabilities

- `dns-web-client`: Settings panel gains connection-header management; WebSocket connect logic applies stored headers; API key UX integrated with header list.
- `dns-resolver-backend`: WebSocket upgrade auth accepts API key from configured HTTP header names in addition to `apikey` query param.

## Impact

- **Webapp**: new `wsHeaderStore.js` (or extend `apiKeyStore.js`), changes to `useDnsSocket.js`, `menu.jsx` Settings panel, possible `config.json` schema extension, IndexedDB prefs usage.
- **Backend**: `ws.rs` upgrade handler reads auth from headers; `config` may gain optional `auth_header_names` list.
- **Protocol / deployment**: no breaking change for existing `?apikey=` clients; header-based auth is additive. Operators may configure proxy rules to map query params to headers where the browser cannot send headers directly.
