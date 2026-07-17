## Purpose

Runtime configuration loading and selection persistence for the web client.

## Requirements

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

### Requirement: Auto Local DNS Server Entry
When a DNS server entry in config has `address: "auto"`, the client SHALL resolve it to the host portion of the currently selected WebSocket URL, or `127.0.0.1` when the host is `localhost` or empty.

#### Scenario: Auto resolves from WS URL host
- **WHEN** the selected WebSocket URL is `ws://192.168.1.10:8080/ws` and a config DNS entry has `"address": "auto"`
- **THEN** that entry is presented and sent to the backend as DNS server `192.168.1.10`

### Requirement: Selection Persistence
The client SHALL persist the user's selected WebSocket URL and DNS server in `localStorage` and restore them on subsequent visits when the saved values are still valid options.

#### Scenario: Restore previous selections
- **WHEN** the user previously selected a WS URL and DNS server that remain in the available options
- **THEN** those selections are pre-selected on next app load

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
