## Context

The webapp already persists custom DNS servers and user preferences in IndexedDB (`webdnsDb.js`, version 2) and exposes settings through a hamburger menu (`menu.jsx`). DNS lookups are one-shot: each session starts with empty form state. The user wants repeatability — named presets like `"A+AAAA+MX cvut.cz"` runnable from the menu, plus a browsable history of past lookups with the resolver used.

This change is client-only; no backend or WebSocket protocol changes.

## Goals / Non-Goals

**Goals:**
- Persist lookup history and quick-lookup presets in IndexedDB alongside existing stores.
- Surface quick lookups directly in the hamburger menu root for one-click execution.
- Re-run history entries and quick lookups by restoring domain, record types, and DNS server, then auto-submitting.
- Provide CRUD + import/export for quick lookups (pattern matches `dnsServerStore.js`).
- Allow promoting a history entry to a quick lookup.

**Non-Goals:**
- Syncing history or presets across devices or users.
- Storing lookup *results* in history (only query parameters).
- Sharing quick lookups via URL or server-side storage.
- Backend changes.

## Decisions

### 1. IndexedDB schema bump (v2 → v3)

Add two object stores to `webdnsDb.js`:

| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| `lookupHistory` | auto-increment `id` | `timestamp` | Recent lookups, newest first |
| `quickLookups` | `id` (UUID string) | `sortOrder` | Named presets |

Bump `DB_VERSION` to 3; create stores in `onupgradeneeded`. Follow existing `runStore` helper pattern from `dnsServerStore.js`.

**Alternative considered:** Single `lookups` store with a `kind` field. Rejected — history and presets have different lifecycles, retention rules, and UI.

### 2. History entry shape

```json
{
  "id": 1,
  "domain": "cvut.cz",
  "recordTypes": ["A", "AAAA", "MX"],
  "dnsServerAddress": "8.8.8.8",
  "dnsServerResolved": "8.8.8.8",
  "timestamp": "2026-07-10T07:28:00.000Z"
}
```

- `dnsServerAddress`: the config/select value (`auto`, `8.8.8.8`, etc.) so re-run can restore the selector.
- `dnsServerResolved`: the IP actually sent in the WebSocket message (useful display in history list).
- Retention: cap at 100 entries; on insert, delete oldest by `timestamp` index.
- Dedup: if latest entry matches domain + sorted recordTypes + dnsServerAddress, update `timestamp` only.

### 3. Quick lookup preset shape

```json
{
  "id": "uuid-v4",
  "name": "A+AAAA+MX cvut.cz",
  "domain": "cvut.cz",
  "recordTypes": ["A", "AAAA", "MX"],
  "dnsServerAddress": "1.1.1.1",
  "sortOrder": 0
}
```

Default name suggestion when saving from form: `{recordTypes joined with +} {domain}` (e.g. `A+AAAA+MX cvut.cz`).

Import/export JSON schema: array of `{ name, domain, recordTypes, dnsServerAddress }` (no `id`/`sortOrder` — assigned on import).

### 4. Apply-and-execute flow in `app.jsx`

Extract a `runLookup({ domain, recordTypes, dnsServerAddress?, autoExecute })` function that:
1. Sets `domain`, `selectedTypes`, and `selectedDnsAddress` state (with fallback if DNS address missing from options).
2. Persists DNS server choice via `setStoredDnsServer`.
3. If `autoExecute` and WebSocket is connected, calls `query()` after state flush (`useEffect` or `queueMicrotask` to avoid stale closure).

Called from:
- Form submit (existing path, plus history recording on response).
- Quick lookup menu click.
- History re-run.

History recording hooks into `useDnsSocket` response/error callbacks in `app.jsx` (not inside the socket hook) to keep the hook transport-focused.

### 5. Menu structure

Root menu nav order:
1. **Quick lookup items** (dynamic, one button per preset, separated by a visual divider)
2. History
3. Settings
4. Manage DNS Servers
5. Manage Quick Lookups
6. About

New panels: `history`, `quick-lookups` (management). Quick lookups at root execute directly; management is a separate sub-panel.

### 6. DNS server restoration

When restoring `dnsServerAddress`:
- If present in `dnsOptions`, select it.
- Else keep current selection and set a transient `resolverFallbackNotice` string (cleared after 5s or next lookup).

Store the config `address` key, not the resolved IP, so `auto` and custom servers round-trip correctly.

## Risks / Trade-offs

- **[Auto-execute races with state updates]** → Use `useEffect` watching a `pendingLookup` ref/object rather than calling `query` synchronously after `setState`.
- **[History grows unbounded]** → Hard cap at 100 entries with prune on write.
- **[Imported quick lookup references unknown DNS server]** → Fallback + notice; preset still usable for domain/types.
- **[Menu clutter with many presets]** → `sortOrder` + management panel; no pagination in v1 (acceptable for personal tool).

## Migration Plan

1. Deploy webapp with DB v3 migration (automatic via `onupgradeneeded`).
2. No data migration from prior versions — new stores start empty.
3. Rollback: revert webapp; IndexedDB v3 stores are ignored by older builds (no harm).

## Open Questions

- None blocking — retention limit (100) and dedup behavior are reasonable defaults and can be made configurable later if needed.
