## MODIFIED Requirements

### Requirement: Hamburger Menu Navigation
The web client SHALL provide a top-right hamburger menu that opens a panel with access to saved quick lookups (listed by name when present), History, Settings, DNS Server Management, Manage Quick Lookups, and About.

#### Scenario: Open menu
- **WHEN** the user clicks the hamburger icon in the top-right corner
- **THEN** a menu panel opens with entries for any saved quick lookups, History, Settings, Manage DNS Servers, Manage Quick Lookups, and About

#### Scenario: Close menu
- **WHEN** the menu is open and the user clicks outside the panel or presses Escape
- **THEN** the menu closes

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
