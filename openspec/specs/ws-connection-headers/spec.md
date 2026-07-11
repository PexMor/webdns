## Purpose

WebSocket connection header management for browser-compatible authentication.

## Requirements

### Requirement: Connection Header Persistence
The web client SHALL persist user-defined WebSocket connection header key-value pairs in IndexedDB and SHALL load them on startup before attempting a WebSocket connection.

#### Scenario: Save new header
- **WHEN** the user adds a header name and value in Settings and saves
- **THEN** the header is stored in IndexedDB and included on the next WebSocket connect

#### Scenario: Remove header
- **WHEN** the user removes a stored header in Settings
- **THEN** the header is deleted from IndexedDB and omitted from subsequent WebSocket connects

#### Scenario: Migrate legacy API key
- **WHEN** a legacy `apiKey` preference exists and no connection headers are stored yet
- **THEN** the client creates a builtin `apikey` header entry with the stored value and continues to connect successfully

### Requirement: Connection Header Import and Export
The web client SHALL allow users to export stored connection headers to a JSON file and import connection headers from a JSON file.

#### Scenario: Export headers
- **WHEN** the user clicks Export in the Connection headers section
- **THEN** the client downloads a JSON array of `{ name, value, enabled? }` objects

#### Scenario: Import headers
- **WHEN** the user imports a valid JSON array of header objects
- **THEN** new headers are merged into storage (duplicate names update existing entries) and the client reports how many were added or updated

#### Scenario: Invalid import
- **WHEN** the user imports a file that is not a JSON array of header objects
- **THEN** the client shows an error and does not modify stored headers

### Requirement: Apply Headers on WebSocket Connect
The web client SHALL apply all enabled connection headers when opening or reconnecting a WebSocket, using query parameters as the browser-compatible carrier.

#### Scenario: Connect with multiple headers
- **WHEN** the user has enabled headers `apikey=secret` and `Authorization=Bearer token` configured
- **THEN** the WebSocket URL includes query parameters for each enabled header (default mapping: `apikey` → `apikey`, `Authorization` → `authorization`)

#### Scenario: Reconnect after header change
- **WHEN** the user modifies connection headers and saves
- **THEN** the client closes the existing socket (if any) and opens a new connection with the updated parameters

#### Scenario: Disabled header omitted
- **WHEN** a stored header has `enabled: false`
- **THEN** that header is not included in the WebSocket URL

### Requirement: Configurable Header Query Mapping
The web client SHALL support optional `wsHeaderQueryMap` entries in `config.json` to override how a header name is encoded as a query parameter.

#### Scenario: Custom query param name
- **WHEN** `config.json` maps `"Authorization"` to `"token"` and the user has an enabled `Authorization` header
- **THEN** the WebSocket URL includes `token=<value>` instead of `authorization=<value>`

### Requirement: Browser Header Limitation Disclosure
The web client SHALL inform users in the Connection headers Settings section that browsers cannot attach arbitrary HTTP headers to WebSocket handshakes and that configured values are sent as query parameters for proxy compatibility.

#### Scenario: Settings hint visible
- **WHEN** the user opens the Connection headers section in Settings
- **THEN** a hint explaining the browser limitation and query-parameter behavior is displayed
