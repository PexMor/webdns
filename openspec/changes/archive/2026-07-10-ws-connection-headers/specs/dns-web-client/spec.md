## MODIFIED Requirements

### Requirement: Settings Panel
The web client SHALL consolidate connection and resolver settings (connection headers, API key, WebSocket URL selection, DNS server selection) in a Settings panel accessible from the hamburger menu.

#### Scenario: Change WebSocket URL
- **WHEN** the user selects a different WebSocket URL in Settings
- **THEN** the client disconnects from the current WebSocket (if connected) and reconnects to the newly selected URL using stored connection headers

#### Scenario: Change DNS server
- **WHEN** the user selects a different DNS server in Settings
- **THEN** subsequent DNS queries include the selected server address in the WebSocket request

#### Scenario: Manage connection headers
- **WHEN** the user opens Settings
- **THEN** a Connection headers section is available to add, edit, enable/disable, remove, import, and export header key-value pairs used for WebSocket authentication

#### Scenario: API key shortcut
- **WHEN** the user enters a value in the API key field and clicks Connect
- **THEN** the client upserts the builtin `apikey` connection header and reconnects using all enabled headers

### Requirement: Connection State Feedback
The web client SHALL indicate to the user when the WebSocket connection is not established (e.g., connecting, disconnected, or authentication failed), so the user is not left waiting with no feedback after submitting a query. The connection status SHALL remain visible in the main header alongside the hamburger menu.

#### Scenario: Backend unreachable or unauthorized
- **WHEN** the WebSocket connection fails to open (e.g., wrong credentials, missing required headers/params, or server not running)
- **THEN** the client displays a connection-error state instead of silently doing nothing when the user submits a query
