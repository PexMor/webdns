## ADDED Requirements

### Requirement: Static Asset Cache Headers
The backend SHALL set a `Cache-Control: max-age=<seconds>` response header on static web asset responses served from `web_root`, where `<seconds>` is a configurable, layered setting (CLI `--static-cache-seconds` > `DNS_STATIC_CACHE_SECONDS` environment variable > `static_cache_seconds` in the TOML config file > built-in default of `600`). This header SHALL NOT be applied to the `/version` or `/ws` endpoints.

#### Scenario: Default static asset cache duration
- **WHEN** the server starts with no `--static-cache-seconds` CLI flag, no `DNS_STATIC_CACHE_SECONDS` environment variable, and no `static_cache_seconds` key in the TOML config file, and a client requests a static asset
- **THEN** the response includes `Cache-Control: max-age=600`

#### Scenario: Configured static asset cache duration
- **WHEN** the server starts with `--static-cache-seconds 3600` (or the equivalent `DNS_STATIC_CACHE_SECONDS` or TOML entry) and a client requests a static asset
- **THEN** the response includes `Cache-Control: max-age=3600`

#### Scenario: Static asset cache header does not affect version/websocket endpoints
- **WHEN** a client requests `GET /version` or opens a `/ws` connection
- **THEN** the static-asset cache-control header is not present on those responses, and `/version` retains its existing `Cache-Control: no-store` header
