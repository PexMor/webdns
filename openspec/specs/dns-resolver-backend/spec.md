## Purpose

DNS resolver backend service providing WebSocket-based multi-record-type DNS resolution.

## Requirements

### Requirement: Layered Configuration
The backend SHALL load configuration (API key, bind address) with precedence CLI arguments > environment variables (`DNS_` prefix) > TOML file (explicit `--config` path, or default `~/.config/dnsapi/config.toml`) > built-in defaults.

#### Scenario: TOML-only configuration
- **WHEN** no CLI flags or `DNS_*` env vars are set and `~/.config/dnsapi/config.toml` contains `api_key` and `bind`
- **THEN** the server starts using the values from the TOML file

#### Scenario: Environment variable overrides TOML
- **WHEN** `~/.config/dnsapi/config.toml` sets `api_key = "toml-key"` and the process is started with `DNS_API_KEY=envkey`
- **THEN** the server uses `envkey` as the API key

#### Scenario: CLI argument overrides environment and TOML
- **WHEN** both a TOML file and `DNS_API_KEY` are set, and the process is started with `--api-key clikey`
- **THEN** the server uses `clikey` as the API key

#### Scenario: Missing required configuration
- **WHEN** no `api_key` is available from any source (CLI, env, or TOML)
- **THEN** the server fails to start and prints an error identifying the missing configuration, instead of starting with an empty/undefined key

### Requirement: WebSocket Authentication
The backend SHALL require a valid API key on every WebSocket upgrade request. The key MAY be supplied as an `apikey` query parameter OR as an HTTP header on the upgrade request. The backend SHALL reject the upgrade if no valid credential is present.

Accepted header names (case-insensitive, checked in order until a match is found):

- `X-API-Key`
- `Authorization` (value MAY include a `Bearer ` prefix which SHALL be stripped before comparison)
- `apikey`

#### Scenario: Valid API key via query parameter
- **WHEN** a client connects to `/ws?apikey=<configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Valid API key via header
- **WHEN** a client connects to `/ws` with header `X-API-Key: <configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Valid API key via Authorization header
- **WHEN** a client connects to `/ws` with header `Authorization: Bearer <configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Missing or invalid credentials
- **WHEN** a client connects to `/ws` with no `apikey` query parameter and no matching auth header
- **THEN** the server responds with HTTP 401 Unauthorized and does not upgrade the connection

#### Scenario: Invalid credential value
- **WHEN** a client supplies an `apikey` query parameter or auth header that does not match the configured key
- **THEN** the server responds with HTTP 401 Unauthorized and does not upgrade the connection

### Requirement: Multi-Record-Type DNS Resolution
Given a connected, authenticated client, the backend SHALL accept a JSON request containing a domain, a list of DNS record types, and an optional `dns_server` IP address, resolve all requested record types concurrently using the specified (or default) upstream resolver, and return a single JSON response containing one result entry per requested record type, in the same order as requested.

#### Scenario: All record types resolve successfully
- **WHEN** a client sends `{"domain": "example.com", "record_types": ["A", "AAAA", "MX"]}`
- **THEN** the server returns a response with `domain: "example.com"` and a `results` array with exactly 3 entries, one per requested type, each containing the resolved records and no error

#### Scenario: Unsupported record type
- **WHEN** a client sends a request containing a `record_types` entry that is not a valid DNS record type (e.g., `"NOTAREALTYPE"`)
- **THEN** the corresponding result entry has an empty records list and a non-null `error` describing the unsupported type, while other valid record types in the same request still resolve normally

#### Scenario: Resolution failure for one record type does not block others
- **WHEN** a client requests multiple record types and resolution fails for one of them (e.g., NXDOMAIN for `MX` on a domain that only has `A` records)
- **THEN** the response includes a populated result for the successful record types and a result with an `error` (and empty records) for the failed one, in a single response

#### Scenario: Malformed request
- **WHEN** a client sends a WebSocket text message that is not valid JSON or does not match the expected request shape
- **THEN** the server sends back an error message describing the problem and keeps the connection open for subsequent requests

### Requirement: Server Observability
The backend SHALL emit structured startup and request-level logs (bind address, connection events, resolution errors) via a tracing framework, configurable via standard log-level environment conventions. On startup, the backend SHALL additionally log its version, git commit hash, and build datetime using colored output.

#### Scenario: Startup log
- **WHEN** the server starts successfully
- **THEN** it logs the bound address it is listening on, plus version, git hash, and build time

### Requirement: Secure Mode DNS Server Allowlist Configuration
The backend SHALL support a `secure_mode` boolean setting (CLI `--secure-mode`, environment `DNS_SECURE_MODE`, TOML `secure_mode`, default `false`) and an `allowed_dns_servers` list of IP addresses (CLI repeatable `--allowed-dns-server`, environment `DNS_ALLOWED_DNS_SERVERS` as a comma-separated list, TOML `allowed_dns_servers` array, default empty), loaded with the same CLI > environment > TOML > default precedence as other configuration. Every entry in `allowed_dns_servers` SHALL be validated as a syntactically valid IPv4 or IPv6 address at startup. The backend SHALL log the resolved `secure_mode` value and, when enabled, the resolved `allowed_dns_servers` list at startup.

#### Scenario: Secure mode enabled via TOML with an allowlist
- **WHEN** the config file sets `secure_mode = true` and `allowed_dns_servers = ["1.1.1.1", "9.9.9.9"]`, with no CLI/env overrides
- **THEN** the server starts with secure mode enabled and an allowlist containing exactly those two addresses, and logs both values at startup

#### Scenario: Secure mode enabled with an invalid entry in the allowlist
- **WHEN** the server starts with `secure_mode = true` and `allowed_dns_servers` containing a value that is not a valid IP address
- **THEN** the server fails to start and prints an error identifying the invalid `allowed_dns_servers` entry

#### Scenario: Secure mode enabled with an empty allowlist
- **WHEN** the server starts with `secure_mode = true` and no `allowed_dns_servers` configured from any source
- **THEN** the server fails to start and prints an error explaining that `secure_mode` requires at least one entry in `allowed_dns_servers`

#### Scenario: Secure mode left at default
- **WHEN** the server starts with no `secure_mode` or `allowed_dns_servers` configured from any source
- **THEN** the server starts with secure mode disabled and behaves as it does today, accepting any syntactically valid `dns_server` in requests

### Requirement: Per-Request DNS Server Selection
The backend SHALL accept an optional `dns_server` field in WebSocket JSON requests containing an IPv4 or IPv6 address, and SHALL use that address as the upstream DNS resolver for that request, subject to the allowlist enforcement described below when secure mode is enabled.

When `secure_mode` is disabled (the default), any syntactically valid IP address supplied in `dns_server` is used, and the behavior is unchanged from before secure mode existed.

When `secure_mode` is enabled, the backend SHALL only use servers present in the configured `allowed_dns_servers` list. A request naming a `dns_server` that is not in `allowed_dns_servers` SHALL NOT be silently redirected to a default or otherwise-permitted server; the backend SHALL reject the request with an error response and SHALL NOT perform the resolution.

#### Scenario: Query with explicit DNS server (secure mode disabled)
- **WHEN** a client sends `{"domain": "example.com", "record_types": ["A"], "dns_server": "8.8.8.8"}` and `secure_mode` is disabled
- **THEN** the server resolves the query using 8.8.8.8 as the upstream nameserver

#### Scenario: Query without DNS server field (secure mode disabled)
- **WHEN** a client sends a request without a `dns_server` field and `secure_mode` is disabled
- **THEN** the server uses its default upstream resolver (1.1.1.1) as today

#### Scenario: Invalid DNS server address
- **WHEN** a client sends a request with `dns_server` set to a value that is not a valid IP address
- **THEN** the server responds with a JSON error message describing the invalid address and keeps the connection open

#### Scenario: Query with an allowlisted DNS server (secure mode enabled)
- **WHEN** `secure_mode` is enabled with `allowed_dns_servers = ["9.9.9.9"]` and a client sends `{"domain": "example.com", "record_types": ["A"], "dns_server": "9.9.9.9"}`
- **THEN** the server resolves the query using 9.9.9.9 as the upstream nameserver

#### Scenario: Query with a non-allowlisted DNS server (secure mode enabled)
- **WHEN** `secure_mode` is enabled with `allowed_dns_servers = ["9.9.9.9"]` and a client sends `{"domain": "example.com", "record_types": ["A"], "dns_server": "8.8.8.8"}`
- **THEN** the server does not perform the resolution and instead responds with a JSON error message stating that `8.8.8.8` is not a permitted DNS server, and keeps the connection open

#### Scenario: Query without a DNS server field (secure mode enabled)
- **WHEN** `secure_mode` is enabled with `allowed_dns_servers = ["9.9.9.9", "1.1.1.1"]` and a client sends a request without a `dns_server` field
- **THEN** the server resolves the query using the first configured allowed server (9.9.9.9) as the upstream nameserver

### Requirement: Version Endpoint
The backend SHALL expose an unauthenticated `GET /version` endpoint returning JSON with `version`, `gitHash`, and `buildTime` fields, with a `Cache-Control: no-store` response header so the endpoint is safe to use as a same-origin session probe target behind a caching reverse proxy or identity-aware proxy.

#### Scenario: Fetch version
- **WHEN** a client sends `GET /version`
- **THEN** the server responds with HTTP 200 and a JSON body containing non-empty `version`, `gitHash`, and `buildTime` strings

#### Scenario: Version response is never cached
- **WHEN** a client sends `GET /version`
- **THEN** the response includes a `Cache-Control: no-store` header, ensuring intermediary caches and the browser never serve a stale copy that would mask an identity-proxy intercept

### Requirement: Reverse Proxy Client Address Logging
When the backend is deployed behind a reverse proxy or tunnel (e.g. `cloudflared`), it SHALL prefer `X-Forwarded-For` and `X-Forwarded-Proto` headers over the direct TCP peer address when logging client connection events, if those headers are present on the request.

#### Scenario: Forwarded headers present
- **WHEN** a WebSocket upgrade or HTTP request includes `X-Forwarded-For` and/or `X-Forwarded-Proto` headers
- **THEN** the backend's connection log includes the forwarded client address/protocol instead of (or in addition to) the raw TCP peer address

#### Scenario: No forwarded headers
- **WHEN** a request has no `X-Forwarded-For` header (e.g. direct connection, no proxy in front)
- **THEN** the backend logs the direct TCP peer address as it does today

### Requirement: Static Web Asset Directory Default
The backend SHALL default the static web asset directory (`web_root`) to `../docs/app` (relative to the backend crate) when no override is supplied. This default MAY be overridden, with the same precedence as other layered configuration (CLI `--web-root` > `DNS_WEB_ROOT` environment variable > `web_root` in the TOML config file > built-in default).

#### Scenario: No web_root override configured
- **WHEN** the server starts with no `--web-root` CLI flag, no `DNS_WEB_ROOT` environment variable, and no `web_root` key in the TOML config file
- **THEN** the server serves static assets from `../docs/app` relative to the backend crate

#### Scenario: Explicit web_root override still takes precedence
- **WHEN** the server starts with `--web-root /var/www/webdns` (or `DNS_WEB_ROOT`, or a TOML `web_root` entry)
- **THEN** the server serves static assets from the overridden path instead of `../docs/app`

#### Scenario: Configured web_root directory does not exist
- **WHEN** `serve_web` is enabled and the resolved `web_root` directory does not exist on disk
- **THEN** the server logs a warning identifying the missing path and continues starting, so that static files return 404 until the directory is present
