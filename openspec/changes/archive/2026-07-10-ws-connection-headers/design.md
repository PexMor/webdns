## Context

The webapp (`webapp/`, Preact + Vite PWA) connects to the Rust backend over WebSocket. Authentication today is a single persisted API key appended as `?apikey=<value>` in `useDnsSocket.js`. Settings live in the hamburger menu (`menu.jsx`); user prefs use IndexedDB (`webdnsDb.js`, `preferences` store) and `localStorage` for URL/DNS picks.

Many production deployments terminate TLS and enforce auth at a reverse proxy or API gateway using HTTP headers (`Authorization`, `X-API-Key`, custom gateway headers). The browser **WebSocket API cannot set arbitrary HTTP headers** on the upgrade request — only URL, optional subprotocols, and cookies (same-site) are available from JavaScript.

## Goals / Non-Goals

**Goals:**

- Let users define, persist, import/export, and apply multiple connection credential key-value pairs from Settings.
- Keep backward compatibility with the existing `apikey` query param and stored API key.
- Support header-based auth on the backend upgrade path (for proxies and non-browser clients).
- Bridge browser limitation by encoding configured headers as query parameters with a documented, configurable mapping so operators can rewrite them to real headers at the proxy.
- Reconnect automatically when headers change.

**Non-Goals:**

- True custom HTTP header injection from browser JavaScript (impossible with native WebSocket).
- Per-URL header profiles (one global header set is enough for v1).
- OAuth flows, token refresh, or multi-user auth.
- Changing the DNS query message protocol (auth is upgrade-time only).

## Decisions

### 1. Header storage model

Store connection headers as a JSON array in IndexedDB `preferences` under key `wsConnectionHeaders`:

```json
[
  { "name": "Authorization", "value": "Bearer secret", "enabled": true },
  { "name": "X-Custom-Gateway", "value": "token", "enabled": true }
]
```

Migrate existing `apiKey` pref on first load: if `wsConnectionHeaders` is empty and `apiKey` exists, synthesize `{ "name": "apikey", "value": "<key>", "enabled": true, "builtin": true }` and keep `apiKey` in sync for one release cycle.

**Alternative considered:** separate store object — rejected; prefs pattern already used for API key.

### 2. Browser connect strategy: query-param carrier

On `new WebSocket(url)`, merge enabled headers into the URL query string:

| Header name (user-facing) | Default query param | Notes |
|---------------------------|---------------------|-------|
| `apikey` (builtin)        | `apikey`            | Matches backend today |
| Other headers             | lowercased name     | e.g. `Authorization` → `authorization` |

`config.json` may optionally define `wsHeaderQueryMap` to override param names per header (e.g. map `Authorization` → `token` for a specific gateway).

Show a short hint in Settings: *"Browsers cannot send custom WebSocket headers; values are appended as query parameters. Configure your proxy to map them to HTTP headers if required."*

**Alternative considered:** `Sec-WebSocket-Protocol` only — rejected; single-token, non-standard, poor fit for multiple headers.

### 3. Settings UI

Add **Connection headers** block in Settings (below API key section, which becomes the primary `apikey` row):

- Table/list of header name + masked value + enable toggle + remove
- Add form (name + value)
- Import / Export JSON (`[{ "name", "value", "enabled"? }]`)
- "Connect" / save triggers reconnect (same as API key today)

The dedicated API key input remains as a convenience shortcut that upserts the builtin `apikey` header row.

### 4. Backend auth extension

Extend `ws_handler` in `dns-backend/src/ws.rs` to accept the API key from:

1. `apikey` query parameter (existing), OR
2. Any of these HTTP headers (case-insensitive), first match wins:
   - `X-API-Key`
   - `Authorization` (strip optional `Bearer ` prefix)
   - `apikey` (non-standard but used by some proxies)

Optional config `auth_header_names: string[]` in TOML/env for custom header names.

Reject with 401 if none match configured key.

**Alternative considered:** first-message auth after connect — rejected; breaks proxy gatekeepers that require auth before upgrade.

### 5. config.json defaults

Optional field:

```json
{
  "wsConnectionHeaders": [
    { "name": "X-API-Key", "value": "", "enabled": false }
  ],
  "wsHeaderQueryMap": {
    "Authorization": "authorization"
  }
}
```

Defaults from config are shown in UI as read-only suggestions when empty; user-stored IndexedDB values override on name conflict.

### 6. Security notes

- Header values in query strings appear in server access logs and browser history — same as current `apikey` behavior; document in Settings hint.
- Export JSON contains secrets; filename `ws-connection-headers.json`.
- Values masked in UI (`••••••`) with reveal toggle optional for v1 (can defer reveal toggle).

## Risks / Trade-offs

- **[Browser cannot send real headers]** → Query-param bridge + proxy mapping documentation; backend also accepts headers for proxy-terminated paths.
- **[Secrets in URL]** → Unchanged from today; hint in UI; recommend WSS and trusted proxies.
- **[Header name collisions in query string]** → Configurable `wsHeaderQueryMap`; lowercase default reduces collisions.
- **[Migration from apiKey pref]** → Automatic synthesis on load; dual-write during transition.

## Migration Plan

1. Ship backend first (additive header auth on upgrade).
2. Ship webapp with header store + UI; auto-migrate `apiKey` → header list.
3. Existing deployments using `?apikey=` continue working unchanged.
4. Operators behind header-only gateways configure proxy `map $arg_authorization $http_authorization` (nginx) or equivalent.

Rollback: remove header UI; `apikey` query path still works.

## Open Questions

- Whether to add a "reveal value" toggle in v1 or ship masked-only (recommend masked-only for v1).
- Whether custom backend `auth_header_names` is needed in v1 or hardcoded list is sufficient (recommend hardcoded list + env override for v1).
