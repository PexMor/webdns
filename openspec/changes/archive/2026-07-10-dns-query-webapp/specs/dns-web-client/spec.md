## ADDED Requirements

### Requirement: DNS Query Form
The web client SHALL present a form allowing the user to enter a domain name and select one or more DNS record types (at minimum A, AAAA, MX, TXT, CNAME, NS), and SHALL submit a query to the backend over WebSocket when the user triggers a lookup.

#### Scenario: Submitting a query
- **WHEN** the user enters a domain and selects one or more record types and submits the form
- **THEN** the client sends a single WebSocket message matching the backend's expected request shape (`{domain, record_types}`)

#### Scenario: No record types selected
- **WHEN** the user attempts to submit without selecting any record type
- **THEN** the client prevents submission and indicates that at least one record type must be selected, without sending a WebSocket message

### Requirement: Results Display
The web client SHALL render the backend's response grouped by record type, showing resolved values for successful lookups and a visible error indicator for record types that failed to resolve, without one failed record type hiding the results of others.

#### Scenario: Mixed success and failure response
- **WHEN** the client receives a response where some record types have results and others have an `error` field set
- **THEN** the client displays the successful records normally and clearly marks the failed record types with their error message, in the same view

### Requirement: Connection State Feedback
The web client SHALL indicate to the user when the WebSocket connection is not established (e.g., connecting, disconnected, or authentication failed), so the user is not left waiting with no feedback after submitting a query.

#### Scenario: Backend unreachable or unauthorized
- **WHEN** the WebSocket connection fails to open (e.g., wrong API key or server not running)
- **THEN** the client displays a connection-error state instead of silently doing nothing when the user submits a query

### Requirement: Installable Web App
The web client SHALL be installable as a Progressive Web App, providing a web app manifest and enough offline shell support that the app UI (not live DNS data) loads when launched from an installed icon without network connectivity.

#### Scenario: Install prompt eligibility
- **WHEN** the client is served over a context that supports PWA installation (valid manifest, registered service worker)
- **THEN** a browser's install-app affordance becomes available for the site
