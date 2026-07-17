## 1. Config & types

- [x] 1.1 Add `DemoConfig` / `DemoAutoplayConfig` types to `webapp/src/types.ts` (`enabled`, `dataUrl`, `autoplay.enabled`, `autoplay.intervalMs`).
- [x] 1.2 Extend `RuntimeConfig` with optional `demo` and defaults (`enabled: false`, `dataUrl: "/demo.jsonl"`, `autoplay: { enabled: false, intervalMs: 5000 }`).
- [x] 1.3 Add `normalizeDemoConfig(value: unknown): DemoConfig` in `loadConfig.ts` (invalid/non-object → disabled defaults; do not fail config load).
- [x] 1.4 Parse `demo` in `loadConfig()` and add unit tests in `loadConfig.test.ts` for enabled/disabled/invalid/missing blocks.

## 2. Demo dataset module

- [x] 2.1 Create `webapp/src/demoMode.ts` with `loadDemoDataset(dataUrl): Promise<DemoDataset>` — fetch file, split JSON array vs JSONL lines (reuse the same parsing approach as `menu.tsx` import), validate via `parseHistoryImportEntry`, skip invalid lines.
- [x] 2.2 Export `findDemoMatch(dataset, query: LookupHistoryInput): HistoryExportEntry | null` using the same equivalence logic as `entriesMatch` in `lookupHistoryStore.ts` (extract shared `historyEntryKey` helper if needed to avoid drift).
- [x] 2.3 Export `replayDemoEntry(entry)` return shape compatible with what `executeLookup` expects (`DnsQueryResponse` or error string) plus simulated latency helper.
- [x] 2.4 Unit tests: parse sample JSON + JSONL, match/don't-match on domain/types/DNS server/conventions, replay payload shape.

## 3. App integration — demo mode lifecycle

- [x] 3.1 In `app.tsx` init: when `config.demo.enabled`, call `loadDemoDataset`, set `demoDataset` / `demoReady` / `demoLoadError` state; skip depending on `useDnsSocket` for query execution (pass `credentialsReady: false` or a `demoMode` flag so the hook does not connect).
- [x] 3.2 When demo loads and `listHistory()` is empty, call `importHistory` with parsed entries to seed the History panel.
- [x] 3.3 Branch `executeLookup`: if demo mode, validate via `transformQueryInput`, then `findDemoMatch` → simulated delay → set response/error state + `addHistoryEntry` (mirror live `pendingHistoryRef` flow); on no match set form error “not in demo dataset”.
- [x] 3.4 Update `pendingExecute` effect to run in demo mode without requiring `status === "connected"`.
- [x] 3.5 Show header status `Demo` when demo mode active and data loaded; show load error state when file missing.

## 4. Autoplay UI & scheduler

- [x] 4.1 Add autoplay scheduler in `demoMode.ts` (`startAutoplay`, `stopAutoplay`, `isAutoplayRunning`) driven by `intervalMs`, cycling entries in file order with wrap.
- [x] 4.2 In `app.tsx`, start autoplay after demo load when `config.demo.autoplay.enabled`; wire Stop / Resume control in the main UI (near connection status).
- [x] 4.3 Pause autoplay briefly while a manual/demo replay is in flight; respect user Stop until explicit Resume.
- [x] 4.4 Tests for scheduler: start/stop/wrap/order (use fake timers).

## 5. Sample deploy assets

- [x] 5.1 Add `webapp/public/demo.jsonl` with a small curated sample (2–4 entries covering at least one follow-up target) exported from real history format.
- [x] 5.2 Add commented example `demo` block in `webapp/public/config.json` (disabled by default) documenting static deploy shape (`wsUrls: []`, `demo.enabled: true`, `dataUrl`, `autoplay`).

## 6. Verification

- [x] 6.1 Unit tests: `loadConfig` demo parsing, `demoMode` matching/replay, autoplay scheduler.
- [x] 6.2 Manual: enable demo in config (or use a local override), confirm no WebSocket attempts, history pre-populated, autoplay loops and stops, manual query replays, follow-up click replays when entry exists, unknown query shows error.
- [x] 6.3 Run `webapp` test suite and type checker.
