## MODIFIED Requirements

### Requirement: DNS Query Form
The web client SHALL present a form allowing the user to enter a domain name and select one or more DNS record types (at minimum A, AAAA, MX, TXT, CNAME, NS), and SHALL submit a query to the backend over WebSocket when the user triggers a lookup, except in demo mode where submission replays from the loaded demo dataset. Connection settings (API key, WebSocket URL, DNS server) SHALL be managed via the hamburger menu Settings panel rather than inline on the main form. The form state SHALL be programmatically settable so quick lookups and history re-runs can pre-fill domain, record types, and DNS server before execution.

When a query-name-construction convention (reverse DNS, ENUM, SRV, TLSA, OPENPGPKEY, SMIMEA — per the `dns-query-input-transforms` capability) becomes engaged for the current selection and input, the client SHALL: adjust the domain field's label/placeholder to match the expected input, show a live preview of the query name that will actually be sent, disable selection of other record types for the duration of engagement, and submit the resolved query name in place of the raw input. Selecting one of these record types alone SHALL NOT change form behavior unless its convention is actually engaged — a plain `PTR`, `NAPTR`, `SRV`, `TLSA`, `OPENPGPKEY`, or `SMIMEA` query against a literal domain SHALL work exactly as any other record type does. The user's original raw input (and any convention-specific extra field values) SHALL still be what is persisted to the lookup form, history, and quick lookups — not the resolved query name.

#### Scenario: Submitting a query
- **WHEN** the user enters a domain and selects one or more record types and submits the form
- **THEN** the client sends a single WebSocket message matching the backend's expected request shape (`{domain, record_types, dns_server?}`), or in demo mode replays the matching canned response without WebSocket

#### Scenario: No record types selected
- **WHEN** the user attempts to submit without selecting any record type
- **THEN** the client prevents submission and indicates that at least one record type must be selected, without sending a WebSocket message

#### Scenario: Programmatic lookup execution
- **WHEN** a quick lookup or history re-run sets form state and requests execution
- **THEN** the client performs the same validation and submission as a manual form submit, including recording the lookup in history on completion (WebSocket in live mode, demo replay in demo mode)

#### Scenario: Demo query not in dataset
- **WHEN** demo mode is active and the user submits a query with no matching demo entry
- **THEN** the client shows an error that the query is unavailable in the demo dataset and does not block the UI indefinitely

### Requirement: Connection State Feedback
The web client SHALL indicate to the user when the WebSocket connection is not established (e.g., connecting, disconnected, authentication failed, or identity-proxy session expired), so the user is not left waiting with no feedback after submitting a query. The connection status SHALL remain visible in the main header alongside the hamburger menu. When demo mode is active, the client SHALL show a distinct Demo status instead of WebSocket connection states. When an identity-aware proxy session is detected as expired (per the `identity-proxy-session-detection` capability), the client SHALL present this as a distinct state from a bad app-level API key or a generic connection error, via the blocking re-login prompt rather than the reconnect-backoff status label.

#### Scenario: Backend unreachable or unauthorized
- **WHEN** the WebSocket connection fails to open (e.g., wrong credentials, missing required headers/params, or server not running)
- **THEN** the client displays a connection-error state instead of silently doing nothing when the user submits a query

#### Scenario: Demo mode status
- **WHEN** demo mode is active and demo data is loaded
- **THEN** the header connection status indicates Demo mode rather than connecting/disconnected, and submitting a matching query produces results without a live backend

#### Scenario: Session expired distinct from bad credentials
- **WHEN** identity-proxy detection is enabled and a WebSocket close is classified as an expired proxy session rather than a bad app-level API key
- **THEN** the client shows the blocking re-login prompt instead of the "check credentials" connection-error label, and does not continue the reconnect-backoff loop
