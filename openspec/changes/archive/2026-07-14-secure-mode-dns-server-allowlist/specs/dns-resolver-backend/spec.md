## ADDED Requirements

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

## MODIFIED Requirements

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
