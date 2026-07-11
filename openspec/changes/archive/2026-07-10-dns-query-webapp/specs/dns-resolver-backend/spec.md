## ADDED Requirements

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
The backend SHALL require a valid API key on every WebSocket upgrade request, supplied as an `apikey` query parameter, and SHALL reject the upgrade if the key is missing or does not match the configured key.

#### Scenario: Valid API key
- **WHEN** a client connects to `/ws?apikey=<configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Missing or invalid API key
- **WHEN** a client connects to `/ws` with no `apikey` parameter, or with a value that does not match the configured key
- **THEN** the server responds with HTTP 401 Unauthorized and does not upgrade the connection

### Requirement: Multi-Record-Type DNS Resolution
Given a connected, authenticated client, the backend SHALL accept a JSON request containing a domain and a list of DNS record types, resolve all requested record types concurrently, and return a single JSON response containing one result entry per requested record type, in the same order as requested.

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
The backend SHALL emit structured startup and request-level logs (bind address, connection events, resolution errors) via a tracing framework, configurable via standard log-level environment conventions.

#### Scenario: Startup log
- **WHEN** the server starts successfully
- **THEN** it logs the bound address it is listening on
