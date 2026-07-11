## ADDED Requirements

### Requirement: Per-Request DNS Server Selection
The backend SHALL accept an optional `dns_server` field in WebSocket JSON requests containing an IPv4 or IPv6 address, and SHALL use that address as the upstream DNS resolver for that request.

#### Scenario: Query with explicit DNS server
- **WHEN** a client sends `{"domain": "example.com", "record_types": ["A"], "dns_server": "8.8.8.8"}`
- **THEN** the server resolves the query using 8.8.8.8 as the upstream nameserver

#### Scenario: Query without DNS server field
- **WHEN** a client sends a request without a `dns_server` field
- **THEN** the server uses its default upstream resolver (1.1.1.1) as today

#### Scenario: Invalid DNS server address
- **WHEN** a client sends a request with `dns_server` set to a value that is not a valid IP address
- **THEN** the server responds with a JSON error message describing the invalid address and keeps the connection open

### Requirement: Version Endpoint
The backend SHALL expose an unauthenticated `GET /version` endpoint returning JSON with `version`, `gitHash`, and `buildTime` fields.

#### Scenario: Fetch version
- **WHEN** a client sends `GET /version`
- **THEN** the server responds with HTTP 200 and a JSON body containing non-empty `version`, `gitHash`, and `buildTime` strings

## MODIFIED Requirements

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
