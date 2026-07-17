## MODIFIED Requirements

### Requirement: Runtime Configuration Loading
The web client SHALL fetch `/config.json` at startup and use it to populate available WebSocket endpoint URLs and default DNS server options. The client SHALL also read an optional `demo` object when present.

#### Scenario: Successful config load
- **WHEN** the app starts and `/config.json` returns valid JSON with `wsUrls` and `dnsServers` arrays
- **THEN** the client makes those URLs and DNS servers available for selection before attempting WebSocket connection (unless demo mode is enabled)

#### Scenario: Missing or invalid config
- **WHEN** `/config.json` is missing, unreachable, or contains invalid JSON
- **THEN** the client falls back to a same-origin WebSocket URL (`ws://` or `wss://` derived from `location.host` + `/ws`) and built-in default DNS servers (8.8.8.8, 8.8.4.4, 1.1.1.1, and an auto-local entry)

#### Scenario: Multiple WebSocket URLs
- **WHEN** `config.json` lists more than one entry in `wsUrls`
- **THEN** the client presents a selector allowing the user to choose which URL to connect to

#### Scenario: Relative WebSocket URL
- **WHEN** a `wsUrls` entry is a path-only value such as `/ws`
- **THEN** the client resolves it relative to the current page origin (`location.protocol`, `location.host`)

### Requirement: Demo Configuration
The web client SHALL support an optional `demo` object in `config.json` with:
- `enabled` (boolean, default `false`): activates demo mode
- `dataUrl` (string, default `"/demo.jsonl"`): path to the bundled demo history file
- `autoplay` (object, optional): `{ "enabled": boolean, "intervalMs": number }` controlling automatic replay loop (default `enabled: false`, `intervalMs: 5000`)

#### Scenario: Demo block with data URL
- **WHEN** `config.json` contains `"demo": { "enabled": true, "dataUrl": "/demo.jsonl" }`
- **THEN** the client enters demo mode and loads demo data from `/demo.jsonl` relative to the page origin

#### Scenario: Demo enabled with empty wsUrls
- **WHEN** `demo.enabled` is true and `wsUrls` is an empty array
- **THEN** the client does not attempt WebSocket connection and operates entirely from demo data

#### Scenario: Invalid demo value ignored
- **WHEN** `config.json` contains a `demo` field that is not an object
- **THEN** the client treats demo mode as disabled rather than failing config load
