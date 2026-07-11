## Purpose

Runtime configuration loading and selection persistence for the web client.

## Requirements

### Requirement: Runtime Configuration Loading
The web client SHALL fetch `/config.json` at startup and use it to populate available WebSocket endpoint URLs and default DNS server options.

#### Scenario: Successful config load
- **WHEN** the app starts and `/config.json` returns valid JSON with `wsUrls` and `dnsServers` arrays
- **THEN** the client makes those URLs and DNS servers available for selection before attempting WebSocket connection

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
