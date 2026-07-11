## MODIFIED Requirements

### Requirement: Version Endpoint
The backend SHALL expose an unauthenticated `GET /version` endpoint returning JSON with `version`, `gitHash`, and `buildTime` fields, with a `Cache-Control: no-store` response header so the endpoint is safe to use as a same-origin session probe target behind a caching reverse proxy or identity-aware proxy.

#### Scenario: Fetch version
- **WHEN** a client sends `GET /version`
- **THEN** the server responds with HTTP 200 and a JSON body containing non-empty `version`, `gitHash`, and `buildTime` strings

#### Scenario: Version response is never cached
- **WHEN** a client sends `GET /version`
- **THEN** the response includes a `Cache-Control: no-store` header, ensuring intermediary caches and the browser never serve a stale copy that would mask an identity-proxy intercept

## ADDED Requirements

### Requirement: Reverse Proxy Client Address Logging
When the backend is deployed behind a reverse proxy or tunnel (e.g. `cloudflared`), it SHALL prefer `X-Forwarded-For` and `X-Forwarded-Proto` headers over the direct TCP peer address when logging client connection events, if those headers are present on the request.

#### Scenario: Forwarded headers present
- **WHEN** a WebSocket upgrade or HTTP request includes `X-Forwarded-For` and/or `X-Forwarded-Proto` headers
- **THEN** the backend's connection log includes the forwarded client address/protocol instead of (or in addition to) the raw TCP peer address

#### Scenario: No forwarded headers
- **WHEN** a request has no `X-Forwarded-For` header (e.g. direct connection, no proxy in front)
- **THEN** the backend logs the direct TCP peer address as it does today
