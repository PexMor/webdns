## MODIFIED Requirements

### Requirement: Connection State Feedback
The web client SHALL indicate to the user when the WebSocket connection is not established (e.g., connecting, disconnected, authentication failed, or identity-proxy session expired), so the user is not left waiting with no feedback after submitting a query. The connection status SHALL remain visible in the main header alongside the hamburger menu. When an identity-aware proxy session is detected as expired (per the `identity-proxy-session-detection` capability), the client SHALL present this as a distinct state from a bad app-level API key or a generic connection error, via the blocking re-login prompt rather than the reconnect-backoff status label.

#### Scenario: Backend unreachable or unauthorized
- **WHEN** the WebSocket connection fails to open (e.g., wrong credentials, missing required headers/params, or server not running)
- **THEN** the client displays a connection-error state instead of silently doing nothing when the user submits a query

#### Scenario: Session expired distinct from bad credentials
- **WHEN** identity-proxy detection is enabled and a WebSocket close is classified as an expired proxy session rather than a bad app-level API key
- **THEN** the client shows the blocking re-login prompt instead of the "check credentials" connection-error label, and does not continue the reconnect-backoff loop
