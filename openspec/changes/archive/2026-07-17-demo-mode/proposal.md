## Why

The web client today requires a live DNS resolver backend over WebSocket. That blocks demos, offline showcases, and static hosting of the UI (e.g. GitHub Pages) where no backend is available. Operators already export lookup history from a real instance; that export should be enough to drive a convincing, interactive walkthrough without any network resolver.

## What Changes

- Add a **demo mode** activated when `config.json` enables it (typically with no usable backend WebSocket URLs). The app skips WebSocket connection and credential requirements.
- Extend `config.json` with an optional `demo` object: `dataUrl` pointing at a bundled history file (`/demo.json` or `/demo.jsonl`), plus optional `autoplay` settings.
- On startup in demo mode, fetch and load the demo file using the same entry schema as history export/import (`parseHistoryImportEntry`), populating the in-memory demo dataset and the History panel as if the user had imported the file.
- Lookups in demo mode do not hit the network: the client finds a matching pre-recorded entry (same domain, record types, DNS server address, and convention form state) and replays its stored `results` / `responseError` after a short simulated latency, updating live results and history the same way a real response would.
- Optional **autoplay** loops through the demo entries at a slow, configurable pace; the user can stop (and restart) replay at any time from a visible control in the main UI.
- Follow-up clicks, history re-runs, and quick lookups continue to work when the target query exists in the demo dataset; unknown queries show a clear “not in demo dataset” message instead of hanging or silently failing.
- A visible **Demo** indicator in the connection-status area makes it obvious the app is not talking to a live backend.

## Capabilities

### New Capabilities
- `demo-mode`: defines demo activation rules, bundled data loading, query matching/replay, autoplay loop, and UI affordances when no backend is in use.

### Modified Capabilities
- `webapp-runtime-config`: `config.json` gains an optional `demo` block (`enabled`, `dataUrl`, `autoplay`) and documents that an empty `wsUrls` array together with demo configuration is a supported deployment shape.
- `lookup-history`: demo data loaded at startup is treated as history for display and re-run; demo replay writes/updates history entries the same way live lookups do.
- `dns-web-client`: query submission, connection status, and programmatic lookup paths branch to demo replay when demo mode is active; WebSocket connection is not attempted.

## Impact

- `webapp/public/config.json` (example/demo deployment), new `webapp/public/demo.jsonl` (sample data, optional).
- `webapp/src/loadConfig.ts`, `webapp/src/types.ts`: parse and expose demo configuration.
- New `webapp/src/demoMode.ts` (or similar): load demo file, build lookup index, match queries, autoplay scheduler.
- `webapp/src/app.tsx`: branch `executeLookup` / connection init away from `useDnsSocket` when in demo mode; autoplay stop/start UI.
- `webapp/src/useDnsSocket.ts`: unchanged wire protocol; simply not used in demo mode.
- `webapp/src/menu.tsx`: history import/export docs unchanged; demo load is automatic, not a manual import step.
- Tests for config parsing, query matching, and demo replay behavior.
