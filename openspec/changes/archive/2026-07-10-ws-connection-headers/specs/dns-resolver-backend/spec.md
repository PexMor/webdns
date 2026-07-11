## MODIFIED Requirements

### Requirement: WebSocket Authentication
The backend SHALL require a valid API key on every WebSocket upgrade request. The key MAY be supplied as an `apikey` query parameter OR as an HTTP header on the upgrade request. The backend SHALL reject the upgrade if no valid credential is present.

Accepted header names (case-insensitive, checked in order until a match is found):

- `X-API-Key`
- `Authorization` (value MAY include a `Bearer ` prefix which SHALL be stripped before comparison)
- `apikey`

#### Scenario: Valid API key via query parameter
- **WHEN** a client connects to `/ws?apikey=<configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Valid API key via header
- **WHEN** a client connects to `/ws` with header `X-API-Key: <configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Valid API key via Authorization header
- **WHEN** a client connects to `/ws` with header `Authorization: Bearer <configured-key>`
- **THEN** the WebSocket upgrade succeeds and the connection is established

#### Scenario: Missing or invalid credentials
- **WHEN** a client connects to `/ws` with no `apikey` query parameter and no matching auth header
- **THEN** the server responds with HTTP 401 Unauthorized and does not upgrade the connection

#### Scenario: Invalid credential value
- **WHEN** a client supplies an `apikey` query parameter or auth header that does not match the configured key
- **THEN** the server responds with HTTP 401 Unauthorized and does not upgrade the connection
