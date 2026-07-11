## 1. IndexedDB schema

- [x] 1.1 Bump `DB_VERSION` to 3 in `webdnsDb.js` and add `lookupHistory` (auto-increment key, `timestamp` index) and `quickLookups` (`id` key, `sortOrder` index) stores to `STORES`
- [x] 1.2 Verify existing stores (`customDnsServers`, `preferences`) migrate cleanly on upgrade

## 2. Lookup history store

- [x] 2.1 Create `lookupHistoryStore.js` with `listHistory`, `addHistoryEntry`, `clearHistory` using `runStore`
- [x] 2.2 Implement retention cap (100 entries) and consecutive dedup (same domain + record types + dns server address updates timestamp only)
- [x] 2.3 Export history entry shape: domain, recordTypes, dnsServerAddress, dnsServerResolved, timestamp

## 3. Quick lookup store

- [x] 3.1 Create `quickLookupStore.js` with `listQuickLookups`, `addQuickLookup`, `updateQuickLookup`, `removeQuickLookup`, `reorderQuickLookups`
- [x] 3.2 Implement `importQuickLookups` and `exportQuickLookups` (JSON array, skip duplicates by name on import)
- [x] 3.3 Generate UUID `id` on create; maintain `sortOrder` on add/reorder

## 4. App orchestration

- [x] 4.1 Extract `applyLookupSetup({ domain, recordTypes, dnsServerAddress })` in `app.jsx` to set form state and DNS selector (with fallback + notice when address unavailable)
- [x] 4.2 Add `pendingAutoExecute` pattern (`useEffect`) so quick lookups and history re-runs submit after state is applied
- [x] 4.3 Record history entry after each lookup completes (success or request-level error) with resolved DNS IP
- [x] 4.4 Load quick lookups on init and pass to `Menu`

## 5. Menu UI — quick lookups

- [x] 5.1 Render quick lookup items at top of root menu nav (dynamic list by `sortOrder`, divider before static entries)
- [x] 5.2 Wire quick lookup click to `applyLookupSetup` + auto-execute and close menu
- [x] 5.3 Add `QuickLookupsPanel` sub-panel: list presets, rename, reorder (up/down), delete, save-from-current-form with default name `{types}+{domain}`, import/export JSON
- [x] 5.4 Add "Manage Quick Lookups" entry to root menu nav

## 6. Menu UI — history

- [x] 6.1 Add `HistoryPanel` sub-panel listing entries newest-first (domain, record types, DNS server, time)
- [x] 6.2 Wire entry click to re-run (apply setup + auto-execute) and close menu
- [x] 6.3 Add "Save as Quick Lookup" action per history row (prompt for name, default from entry)
- [x] 6.4 Add "Clear History" with confirmation
- [x] 6.5 Add "History" entry to root menu nav

## 7. Styling and polish

- [x] 7.1 Add CSS for quick lookup menu items, history list, reorder controls, and resolver fallback notice
- [x] 7.2 Show empty states in History and Quick Lookups panels

## 8. Verification

- [x] 8.1 Manual test: create quick lookup `A+AAAA+MX cvut.cz`, run from menu, confirm form pre-fill and immediate execution
- [x] 8.2 Manual test: run several lookups, verify history order, re-run, dedup, and clear
- [x] 8.3 Manual test: import/export quick lookups JSON; verify skip-on-duplicate-name behavior
- [x] 8.4 Manual test: quick lookup with removed custom DNS server falls back gracefully
