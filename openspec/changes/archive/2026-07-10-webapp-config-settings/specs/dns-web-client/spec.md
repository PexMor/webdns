## ADDED Requirements

### Requirement: Hamburger Menu Navigation
The web client SHALL provide a top-right hamburger menu that opens a panel with access to Settings, DNS Server Management, and About.

#### Scenario: Open menu
- **WHEN** the user clicks the hamburger icon in the top-right corner
- **THEN** a menu panel opens with entries for Settings, Manage DNS Servers, and About

#### Scenario: Close menu
- **WHEN** the menu is open and the user clicks outside the panel or presses Escape
- **THEN** the menu closes

### Requirement: Settings Panel
The web client SHALL consolidate connection and resolver settings (API key, WebSocket URL selection, DNS server selection) in a Settings panel accessible from the hamburger menu.

#### Scenario: Change WebSocket URL
- **WHEN** the user selects a different WebSocket URL in Settings
- **THEN** the client disconnects from the current WebSocket (if connected) and reconnects to the newly selected URL using the stored API key

#### Scenario: Change DNS server
- **WHEN** the user selects a different DNS server in Settings
- **THEN** subsequent DNS queries include the selected server address in the WebSocket request

### Requirement: DNS Server Selection in Queries
The web client SHALL send the currently selected DNS server address to the backend as an optional `dns_server` field in each query WebSocket message.

#### Scenario: Query includes DNS server
- **WHEN** the user submits a DNS lookup with DNS server `8.8.8.8` selected
- **THEN** the WebSocket message includes `"dns_server": "8.8.8.8"` alongside `domain` and `record_types`

## MODIFIED Requirements

### Requirement: DNS Query Form
The web client SHALL present a form allowing the user to enter a domain name and select one or more DNS record types (at minimum A, AAAA, MX, TXT, CNAME, NS), and SHALL submit a query to the backend over WebSocket when the user triggers a lookup. Connection settings (API key, WebSocket URL, DNS server) SHALL be managed via the hamburger menu Settings panel rather than inline on the main form.

#### Scenario: Submitting a query
- **WHEN** the user enters a domain and selects one or more record types and submits the form
- **THEN** the client sends a single WebSocket message matching the backend's expected request shape (`{domain, record_types, dns_server?}`)

#### Scenario: No record types selected
- **WHEN** the user attempts to submit without selecting any record type
- **THEN** the client prevents submission and indicates that at least one record type must be selected, without sending a WebSocket message

### Requirement: Connection State Feedback
The web client SHALL indicate to the user when the WebSocket connection is not established (e.g., connecting, disconnected, or authentication failed), so the user is not left waiting with no feedback after submitting a query. The connection status SHALL remain visible in the main header alongside the hamburger menu.

#### Scenario: Backend unreachable or unauthorized
- **WHEN** the WebSocket connection fails to open (e.g., wrong API key or server not running)
- **THEN** the client displays a connection-error state instead of silently doing nothing when the user submits a query
