## Purpose

Offline demo operation for the DNS web client: replay pre-recorded lookup history without a live resolver backend.

## Requirements

### Requirement: Demo Mode Activation
The web client SHALL enter demo mode when `config.json` contains `"demo": { "enabled": true }`. In demo mode the client SHALL NOT open a WebSocket connection or require connection credentials.

#### Scenario: Demo enabled in config
- **WHEN** the app loads `config.json` with `demo.enabled: true`
- **THEN** the client skips WebSocket connection, does not prompt for API keys, and shows a visible Demo status in the connection area

#### Scenario: Demo disabled or absent
- **WHEN** `config.json` omits `demo` or sets `demo.enabled` to false
- **THEN** the client behaves as today, requiring a configured WebSocket backend

### Requirement: Demo Data Loading
The web client SHALL fetch the URL given by `demo.dataUrl` (relative to the page origin, default `/demo.jsonl`) at startup when demo mode is enabled. The file SHALL be a JSON array or JSONL stream of objects using the same schema as history export/import.

#### Scenario: Successful demo file load
- **WHEN** `demo.dataUrl` returns valid history-export entries
- **THEN** the client parses them with the same validation as manual history import, builds an in-memory replay index, and populates the History panel (when local history is empty) as if the user had imported the file

#### Scenario: Missing or invalid demo file
- **WHEN** `demo.dataUrl` is missing, unreachable, or contains no valid entries
- **THEN** the client remains in demo mode, shows an error state explaining the demo data could not be loaded, and does not attempt WebSocket connection

### Requirement: Demo Query Replay
In demo mode, every lookup submission (manual form submit, quick lookup, history re-run, or follow-up click) SHALL resolve by finding a demo entry that matches the query parameters (domain, record types, DNS server address, and convention form state: `enumMode`, `srvFields`, `tlsaFields`) using the same equivalence rules as history deduplication. On match, the client SHALL replay the entry's stored `results` or `responseError` after a brief simulated latency and update live results and history as a real response would.

#### Scenario: Matching query replays stored response
- **WHEN** the user submits a lookup that matches a demo entry with stored `results`
- **THEN** the client displays those results in the live results view after simulated latency and records/updates history

#### Scenario: Matching query replays stored error
- **WHEN** the user submits a lookup that matches a demo entry with `responseError` and no `results`
- **THEN** the client displays that error message after simulated latency

#### Scenario: No matching demo entry
- **WHEN** the user submits a lookup that does not match any demo entry
- **THEN** the client shows a clear error that the query is not available in the demo dataset and does not hang or attempt WebSocket connection

#### Scenario: Follow-up replay
- **WHEN** the user clicks an actionable parsed field (per `rr-followup-actions`) and the follow-up query exists in the demo dataset
- **THEN** the follow-up executes and replays the matching demo response the same way as a manual submit

### Requirement: Demo Autoplay
When `demo.autoplay.enabled` is true, the client SHALL automatically execute demo entries in file order at the interval specified by `demo.autoplay.intervalMs` (default 5000), wrapping from the last entry back to the first indefinitely until stopped by the user.

#### Scenario: Autoplay starts on load
- **WHEN** demo mode is active, demo data loaded successfully, and `demo.autoplay.enabled` is true
- **THEN** the client begins stepping through demo entries at the configured interval without user action

#### Scenario: User stops autoplay
- **WHEN** the user clicks Stop on the demo replay control
- **THEN** autoplay halts and remains stopped until the user explicitly starts it again

#### Scenario: User restarts autoplay
- **WHEN** autoplay was stopped and the user clicks Start (or Resume)
- **THEN** autoplay resumes from the next entry in sequence
