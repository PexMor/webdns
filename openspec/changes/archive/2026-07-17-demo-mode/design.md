## Context

The web client already has everything needed to **represent** lookups offline: `LookupHistoryEntry` stores domain, record types, DNS server, convention form state (`enumMode`, `srvFields`, `tlsaFields`), and the full per-type `results` / `responseError` payload. `exportHistory()` / `importHistory()` round-trip this as a JSON array or JSONL, with `parseHistoryImportEntry()` as the single validation/normalization gate.

Live lookups flow: `executeLookup` → `transformQueryInput` → `useDnsSocket.query` → WebSocket → `response` state → `addHistoryEntry`. Programmatic paths (quick lookups, history re-run, follow-up clicks) all converge on `executeLookup` / `handleRunLookupSetup`.

Demo mode should reuse this pipeline with a local “resolver” that returns canned data instead of opening a WebSocket.

## Goals / Non-Goals

**Goals:**
- Ship a static-friendly deployment: `config.json` with `demo.enabled: true`, empty `wsUrls`, and `demo.dataUrl: "/demo.jsonl"` is enough to run the full UI.
- Demo data format is exactly the history export format — operators record a session on a real instance, export history, drop the file in `public/`.
- Loaded demo entries appear in History immediately; autoplay optionally walks through them slowly in a loop.
- Manual queries, follow-ups, history re-runs, and quick lookups replay from the dataset when a match exists.
- User can stop (and restart) autoplay at any time; manual interaction does not require stopping autoplay first but pauses autoplay while a manual query is “in flight” (see below).
- Clear “Demo” status in the header; no credential prompts or reconnect loops.

**Non-Goals:**
- Partial / fuzzy matching (e.g. “closest” domain). No match → explicit not-found error.
- Recording or exporting demo data from demo mode itself (use a real backend for capture).
- Editing the demo dataset from the UI.
- Simulating WebSocket connection delays, auth failures, or identity-proxy flows.
- Backend or wire-format changes.

## Decisions

**Activate demo mode from `config.json`, not from connection failure heuristics.**
`demo.enabled: true` (default `false` when absent) is the switch. A typical static deploy also sets `wsUrls: []` so `useDnsSocket` is never started. We do not auto-fallback to demo when a configured backend is unreachable — that would surprise operators who expect a connection error. Demo is always an explicit deployment choice.

**Reuse `parseHistoryImportEntry` for demo file parsing; keep demo data in memory, seed IndexedDB history once.**
On startup, fetch `demo.dataUrl`, parse lines/objects the same way `menu.tsx` does for import, validate via `parseHistoryImportEntry`, and store in a `DemoDataset` module (array + hash index). Also call `importHistory` (or a thin wrapper) to populate the History panel, but only when local history is empty — so repeat visits don’t duplicate rows. The in-memory index is the source of truth for replay matching; IndexedDB is for UX continuity.

**Match queries on the same key as history deduplication plus convention state.**
`entriesMatch` in `lookupHistoryStore.ts` already compares `domain`, `dnsServerAddress`, sorted `recordTypes`, and `conventionKey` (`enumMode`, `srvFields`, `tlsaFields`). Demo replay uses the same comparison against the user’s *form* parameters (before `transformQueryInput`), because exported history stores the user-facing domain, not the constructed `in-addr.arpa` name. `executeLookup` still runs `transformQueryInput` first for validation; on success, matching uses the pending-execute form fields, not the transformed query name.

**Branch at `executeLookup`, not inside `useDnsSocket`.**
`app.tsx` checks `isDemoMode` (from loaded config + dataset ready). When true, `executeLookup` calls `demoReplayLookup(...)` instead of `query(...)`. The replay function applies a short `setTimeout` (e.g. 300–600 ms random jitter) then sets `response` / `errorMessage` state identically to a WebSocket message, and records history via `addHistoryEntry`. This keeps `useDnsSocket` untouched and avoids faking an open WebSocket.

**Autoplay is a small scheduler in `demoMode.ts`, controlled from `app.tsx`.**
Config shape:
```json
"demo": {
  "enabled": true,
  "dataUrl": "/demo.jsonl",
  "autoplay": { "enabled": true, "intervalMs": 5000 }
}
```
When `autoplay.enabled`, after demo data loads, start an interval (default 5000 ms) that calls `handleRunLookupSetup` for the next entry in file order (wrap to start). Expose `stopAutoplay()` / `startAutoplay()`; stopping clears the timer and shows a “Replay stopped” affordance to resume. Manual `executeLookup` sets a `autoplayPausedByUser` flag only if the user explicitly stopped; incidental manual queries temporarily pause the timer for the duration of simulated latency, then resume if autoplay was running.

**Connection status shows `Demo` instead of WebSocket state.**
When demo mode is active, the header status label is `demo` / `Demo mode` (no reconnect/backoff). Settings panels that configure WebSocket URL / API key are hidden or read-only with an explanation — minimal change: leave settings accessible but show a banner that credentials are unused in demo mode.

**Follow-up queries work without extra wiring.**
Follow-ups already call `handleRunLookupSetup` → `executeLookup`. As long as the demo dataset includes the follow-up target entries (captured during the original session), clicks behave identically to live mode. Document that demo authors should record the full exploration path they want clickable.

**Export path for building demo files: existing History → Export.**
No new export UI. Document in `demo.jsonl` sample/README comment that operators use Menu → History → Export (JSON or JSONL).

## Risks / Trade-offs

- **Dataset gaps feel broken** → Mitigated by clear “No matching demo response for this query” error and documenting that demo files should include all follow-up targets.
- **Large demo files slow startup** → Acceptable for demo deploys; parse once at init. Optional future: lazy load (out of scope).
- **History import on every load duplicates entries** → Only seed IndexedDB when history is empty; otherwise rely on in-memory index from fetched file.
- **Convention transforms vs. stored domain** → Matching on form parameters (not transformed query name) aligns with how history is stored today; convention validation still runs so invalid input is rejected before lookup.

## Migration Plan

Additive feature behind `demo.enabled`. Default `config.json` unchanged (`demo` absent → current behavior). Static demo deploy adds `demo.jsonl` + config block. No data migration. Rollback: remove `demo` block and restore `wsUrls`.
