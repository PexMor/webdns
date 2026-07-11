## ADDED Requirements

### Requirement: Identity Proxy Configuration
The web client SHALL support an optional `identityProxy` object in `config.json` with `enabled` (boolean, default `false`) and `probePath` (string, default `"/version"`) fields, controlling whether identity-proxy session-expiry detection is active and which same-origin path is probed.

#### Scenario: Identity proxy detection enabled
- **WHEN** `config.json` contains `"identityProxy": { "enabled": true }`
- **THEN** the client activates session-probe behavior (see `identity-proxy-session-detection` capability) using `probePath` if provided, or `/version` otherwise

#### Scenario: Identity proxy detection disabled or absent
- **WHEN** `config.json` omits `identityProxy` or sets `"enabled": false`
- **THEN** the client does not probe, does not show the re-login overlay, and does not alter WebSocket reconnect behavior

#### Scenario: Invalid identityProxy value ignored
- **WHEN** `config.json` contains an `identityProxy` field that is not an object (e.g., a string or number)
- **THEN** the client treats identity-proxy detection as disabled rather than failing config load
