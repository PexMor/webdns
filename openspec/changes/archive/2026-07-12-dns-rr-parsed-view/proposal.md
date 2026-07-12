## Why

The web client currently renders every DNS answer as an opaque string (hickory-resolver's zone-file presentation format, e.g. `10 mail.example.com.` or `0 issue "letsencrypt.org"`). Users who don't already know the RFC field order for a given RR type (SOA serial/refresh/retry/expire/minimum, CAA flag/tag/value, SSHFP algorithm/type/fingerprint, DNSKEY flags/protocol/algorithm, ...) can't tell what they're looking at without leaving the app. The record type help modal has the same problem in reverse: it shows a static example string but never the user's actual live data.

## What Changes

- Add a per-record-type parser layer that turns each raw answer string (plus its record type) into a typed, named-field structure (e.g. SOA → `{mname, rname, serial, refresh, retry, expire, minimum}`).
- Add a modular "RR view" component set — one renderer per DNS RR type family — that displays the parsed fields with inline labels and explanations, falling back to a generic label/value view for any record type without a dedicated renderer (including record types the parser doesn't recognize or fails to parse).
- Add a per-record raw/parsed toggle in the results view so users can always drop back to the exact raw string the backend returned.
- Reuse the same RR view components inside the record type help modal, driven by a representative example per type, and add the same raw/parsed toggle there.
- Add a configurable explanation detail level (e.g. minimal / standard / detailed) that controls how much inline guidance each RR view shows per field, applied consistently across results and the help modal, persisted the same way existing display preferences are (`displayPrefsStore.ts` / IndexedDB `prefs` store).
- No backend changes: parsing happens entirely client-side against the existing `records: string[]` shape already returned by the backend.

## Capabilities

### New Capabilities
- `dns-rr-parsed-view`: Per-RR-type parsing of raw DNS answer strings into named fields, modular per-type display components with a configurable explanation detail level, and a raw/parsed toggle usable both in query results and the record type help modal.

### Modified Capabilities
- `dns-web-client`: The "Results Display" requirement changes from showing raw answer strings to showing the parsed RR view by default (with a raw fallback/toggle), for both successful and partially-failed responses.

## Impact

- Affected code: `webapp/src/RecordResultCard.tsx`, `webapp/src/RecordTypeHelpModal.tsx`, `webapp/src/formatRecordResult.ts`, `webapp/src/recordTypeHelp.ts`, `webapp/src/displayPrefsStore.ts`, `webapp/src/types.ts`.
- New code: a `webapp/src/rr/` module with one parser + one view component per supported RR type family, plus a registry that maps `record_type` to its parser/view pair and a shared "unknown/unparsed" fallback view.
- No backend (`dns-backend`) or wire-format changes; `DnsRecordResult.records` remains `string[]`.
- No new dependencies expected; parsing is plain TypeScript string parsing of the existing presentation-format strings.
