## Purpose

Web client for DNS lookups over WebSocket with PWA support, settings, history, and quick lookups.

## Requirements

### Requirement: DNS Query Form
The web client SHALL present a form allowing the user to enter a domain name and select one or more DNS record types (at minimum A, AAAA, MX, TXT, CNAME, NS), and SHALL submit a query to the backend over WebSocket when the user triggers a lookup. Connection settings (API key, WebSocket URL, DNS server) SHALL be managed via the hamburger menu Settings panel rather than inline on the main form. The form state SHALL be programmatically settable so quick lookups and history re-runs can pre-fill domain, record types, and DNS server before execution.

#### Scenario: Submitting a query
- **WHEN** the user enters a domain and selects one or more record types and submits the form
- **THEN** the client sends a single WebSocket message matching the backend's expected request shape (`{domain, record_types, dns_server?}`)

#### Scenario: No record types selected
- **WHEN** the user attempts to submit without selecting any record type
- **THEN** the client prevents submission and indicates that at least one record type must be selected, without sending a WebSocket message

#### Scenario: Programmatic lookup execution
- **WHEN** a quick lookup or history re-run sets form state and requests execution
- **THEN** the client performs the same validation and WebSocket submission as a manual form submit, including recording the lookup in history on completion

### Requirement: Results Display
The web client SHALL render the backend's response grouped by record type, showing resolved values for successful lookups and a visible error indicator for record types that failed to resolve, without one failed record type hiding the results of others.

#### Scenario: Mixed success and failure response
- **WHEN** the client receives a response where some record types have results and others have an `error` field set
- **THEN** the client displays the successful records normally and clearly marks the failed record types with their error message, in the same view

### Requirement: Connection State Feedback
The web client SHALL indicate to the user when the WebSocket connection is not established (e.g., connecting, disconnected, authentication failed, or identity-proxy session expired), so the user is not left waiting with no feedback after submitting a query. The connection status SHALL remain visible in the main header alongside the hamburger menu. When an identity-aware proxy session is detected as expired (per the `identity-proxy-session-detection` capability), the client SHALL present this as a distinct state from a bad app-level API key or a generic connection error, via the blocking re-login prompt rather than the reconnect-backoff status label.

#### Scenario: Backend unreachable or unauthorized
- **WHEN** the WebSocket connection fails to open (e.g., wrong credentials, missing required headers/params, or server not running)
- **THEN** the client displays a connection-error state instead of silently doing nothing when the user submits a query

#### Scenario: Session expired distinct from bad credentials
- **WHEN** identity-proxy detection is enabled and a WebSocket close is classified as an expired proxy session rather than a bad app-level API key
- **THEN** the client shows the blocking re-login prompt instead of the "check credentials" connection-error label, and does not continue the reconnect-backoff loop

### Requirement: Installable Web App
The web client SHALL be installable as a Progressive Web App, providing a web app manifest and enough offline shell support that the app UI (not live DNS data) loads when launched from an installed icon without network connectivity.

#### Scenario: Install prompt eligibility
- **WHEN** the client is served over a context that supports PWA installation (valid manifest, registered service worker)
- **THEN** a browser's install-app affordance becomes available for the site

### Requirement: Hamburger Menu Navigation
The web client SHALL provide a top-right hamburger menu that opens a panel with access to saved quick lookups (listed by name when present), History, Settings, DNS Server Management, Manage Quick Lookups, and About.

#### Scenario: Open menu
- **WHEN** the user clicks the hamburger icon in the top-right corner
- **THEN** a menu panel opens with entries for any saved quick lookups, History, Settings, Manage DNS Servers, Manage Quick Lookups, and About

#### Scenario: Close menu
- **WHEN** the menu is open and the user clicks outside the panel or presses Escape
- **THEN** the menu closes

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

### Requirement: DNS Server Selection in Queries
The web client SHALL send the currently selected DNS server address to the backend as an optional `dns_server` field in each query WebSocket message.

#### Scenario: Query includes DNS server
- **WHEN** the user submits a DNS lookup with DNS server `8.8.8.8` selected
- **THEN** the WebSocket message includes `"dns_server": "8.8.8.8"` alongside `domain` and `record_types`
