## Why

Every DNS lookup currently starts from scratch: the user must re-enter the domain, re-select record types, and re-choose the resolver. For repeated diagnostics (e.g. checking `cvut.cz` with A+AAAA+MX against a specific resolver) this is tedious and error-prone. Persisting lookup history and named quick-lookup presets makes the tool practical for day-to-day use.

## What Changes

- Record each completed lookup in IndexedDB (domain, record types, DNS server address, timestamp) and expose a browsable history in the hamburger menu.
- Allow the user to re-run any history entry with one click (restoring domain, record types, and DNS server, then executing the query).
- Add user-defined **quick lookups**: named presets (e.g. `"A+AAAA+MX cvut.cz"`) that appear in the hamburger menu and, when selected, pre-fill the lookup form and immediately execute the query.
- Provide a management panel to create, rename, reorder, delete, import, and export quick lookups (JSON), mirroring the existing custom DNS server workflow.
- Optionally promote a history entry to a quick lookup from the history panel.
- Extend the IndexedDB schema with new object stores for history and quick lookups.

## Capabilities

### New Capabilities

- `lookup-history`: Persist recent DNS lookups in IndexedDB, display them in the menu, allow re-run and clear, with a configurable retention limit.
- `quick-lookups`: User-defined named lookup presets stored in IndexedDB, listed in the hamburger menu for one-click pre-fill and execute, with CRUD and import/export.

### Modified Capabilities

- `dns-web-client`: Hamburger menu gains History and Quick Lookups sections; selecting a quick lookup or history re-run SHALL restore form state (domain, record types, DNS server) and trigger lookup.

## Impact

- **Webapp**: New IndexedDB stores and modules (`lookupHistoryStore.js`, `quickLookupStore.js`), DB version bump in `webdnsDb.js`, new menu panels in `menu.jsx`, orchestration changes in `app.jsx` for pre-fill and auto-execute.
- **Backend / protocol**: No changes — history and presets are client-only.
- **Dependencies**: Reuses existing IndexedDB infrastructure (`webdnsDb.js`, `idb`); no new packages expected.
