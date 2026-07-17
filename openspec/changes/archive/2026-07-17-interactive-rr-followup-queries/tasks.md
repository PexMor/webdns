## 1. Field kind & type plumbing

- [x] 1.1 Extend `RrFieldMeta["kind"]` in `webapp/src/rr/types.ts` to `"duration-seconds" | "ip-address" | "hostname" | "email-encoded"`.
- [x] 1.2 Define a `FollowUpQuery` type (`{ domain: string; recordTypes: string[] }`) exported from `webapp/src/rr/types.ts`.
- [x] 1.3 Add `onFollowUp?: (query: FollowUpQuery) => void` to `RrViewProps` and thread it through `FieldList` to `LabeledField`.

## 2. LabeledField rendering

- [x] 2.1 In `LabeledField`, render `ip-address`/`hostname` kind values as a clickable element (button-styled link) when `onFollowUp` is supplied, calling it with `{ domain: value, recordTypes: ["PTR"] }` for `ip-address` and `{ domain: value, recordTypes: ["A", "AAAA"] }` for `hostname`.
- [x] 2.2 Guard `hostname` kind: treat exact `.` or empty/whitespace-only values as non-actionable plain text regardless of `onFollowUp`.
- [x] 2.3 Fall back to current plain-text rendering for `ip-address`/`hostname` kinds when `onFollowUp` is not supplied.
- [x] 2.4 Add `email-encoded` rendering: show the existing raw value plus a `mailto:` link when a decoded address is available (value supplied pre-decoded by the caller, per task 3.2), and just the raw value when it isn't.
- [x] 2.5 Add/extend `LabeledField` unit tests covering: clickable rendering with handler present, plain-text fallback with handler absent, `.`/empty placeholder exclusion, and `email-encoded` link presence/absence.

## 3. Per-record-type field metadata

- [x] 3.1 Mark `address` as `kind: "ip-address"` in `webapp/src/rr/records/address.ts` (A, AAAA).
- [x] 3.2 Add a `decodeSoaRname(rname: string): string | null` helper in `webapp/src/rr/records/soa.ts` (RFC 1035 rname decoding: first unescaped `.` splits local part from domain, `\.` is a literal dot; returns `null` when no valid split exists) with unit tests; mark `rname` as `kind: "email-encoded"` and pass the decoded value through to the view.
- [x] 3.3 Mark `mname` as `kind: "hostname"` in `webapp/src/rr/records/soa.ts`.
- [x] 3.4 Mark `exchange` as `kind: "hostname"` in `webapp/src/rr/records/mx.ts`.
- [x] 3.5 Mark the `target` field as `kind: "hostname"` for NS/CNAME/PTR/ANAME in `webapp/src/rr/records/name.ts`.
- [x] 3.6 Mark `target` as `kind: "hostname"` in `webapp/src/rr/records/srv.ts` and `webapp/src/rr/records/svcb.ts` (HTTPS/SVCB).
- [x] 3.7 Mark `replacement` as `kind: "hostname"` in `webapp/src/rr/records/naptr.ts`.

## 4. Wiring click-to-query into the app

- [x] 4.1 Add an `onFollowUp` prop to `RecordResultCard` (and its internal `RrRecordView`) that forwards down to the `View` component.
- [x] 4.2 In `app.tsx`, pass a handler to both `RecordResultCard` call sites (live `response.results` and `viewingHistoryEntry.results`) that adapts a `FollowUpQuery` into a full `LookupSetup` (`autoExecute: true`, no DNS server override) and calls the existing `handleRunLookupSetup`.
- [x] 4.3 Confirm `RecordTypeHelpModal` passes no `onFollowUp` (leave its `entry.View` call as-is) so help examples stay non-interactive.

## 5. Verification

- [x] 5.1 Add/extend tests in `RecordResultCard.test.tsx` covering: clicking an A/AAAA address triggers a PTR follow-up callback with the correct payload; clicking an MX exchange/NS target triggers an A+AAAA follow-up callback; `.`/empty target values render without a follow-up trigger.
- [x] 5.2 Manually verify in the running app: query `A`/`AAAA` for a real domain, click the address, confirm a `PTR` lookup auto-runs; query `MX`, click the exchange hostname, confirm an `A`+`AAAA` lookup auto-runs; query `SOA`, confirm the `mailto:` link opens/copies the expected address; repeat from a re-opened history entry.
- [x] 5.3 Run `yarn test` (or project equivalent) and the type checker in `webapp/` to confirm no regressions.

## 6. SPF mechanism follow-ups (TXT records)

- [x] 6.1 Extract a reusable `FollowUpValue` component (and `followUpForKind`/`isPlaceholderHostname` helpers) from `LabeledField.tsx` so an `ip-address`/`hostname` value can be rendered clickable from outside a whole field row (needed for embedded tokens).
- [x] 6.2 Add `webapp/src/rr/records/spf.ts`: `parseSpfTerm`/`parseSpfTerms`, splitting an SPF (`v=spf1`) string into terms with `{ prefix, value, kind, suffix, raw }`; `a`/`mx`/`include`/`exists` and `redirect=` resolve to `kind: "hostname"`, `ip4`/`ip6` resolve to `kind: "ip-address"`, with CIDR suffixes and macro-letter domain-specs excluded from the clickable value. Unit tests in `spf.test.ts`.
- [x] 6.3 Convert `webapp/src/rr/records/txt.ts` to `txt.tsx` with a bespoke `TxtView`: join the record's `strings`, detect SPF via `parseSpfTerms`, and render each term via `FollowUpValue` when actionable, plain text otherwise; fall back to the existing `LabeledField`-based display for non-SPF TXT content.
- [x] 6.4 Fix `parseTxt` to only whitespace-split on genuinely quoted (`"..."`) content; treat an unquoted raw value as a single character-string so multi-word unquoted TXT/SPF answers keep their original spacing. Add a regression test.
- [x] 6.5 Add `RecordResultCard.test.tsx` coverage: `a:`/`ip4:` mechanism clicks trigger the right follow-up; bare `mx`/`-all` are not clickable; non-SPF TXT text is not clickable; an unquoted SPF answer (as returned by some backends) works identically to a quoted one.

## 7. SVCB/HTTPS address-hint follow-ups

- [x] 7.1 Add `parseAddressHint` to `webapp/src/rr/records/svcb.ts` (`.tsx`): for `ipv4hint`/`ipv6hint` params, split the comma-separated address list; other params return `null`. Unit tests in `svcb.test.ts`.
- [x] 7.2 Convert `svcb.ts` to `svcb.tsx` with a bespoke `SvcbView`: keep `LabeledField` for `priority`/`target`, and render `params` with each `ipv4hint`/`ipv6hint` address as its own `FollowUpValue` (`kind: "ip-address"`), other params as plain text.
- [x] 7.3 Add `RecordResultCard.test.tsx` coverage: clicking one address in a multi-address `ipv4hint` triggers a PTR follow-up with just that address; `alpn`/other params are not clickable.

## 8. Verification (round 2)

- [x] 8.1 Run the full `webapp` test suite and type checker again; confirm no regressions from the `txt`/`svcb` conversions or the `parseTxt` fix.
- [x] 8.2 Manually verify against a real backend: query `TXT` for a domain with a real SPF record, confirm `a:`/`ip4:`/`include:` mechanisms are clickable and bare `mx`/`-all` are not, and that clicking an `ip4:` address auto-runs `PTR`; query `HTTPS`/`SVCB` for a domain with address hints, confirm each comma-separated `ipv4hint`/`ipv6hint` address is independently clickable and auto-runs `PTR`.
