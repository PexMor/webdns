## 1. Reverse DNS (PTR) and ENUM (NAPTR) primitives

- [x] 1.1 Create `webapp/src/queryTransforms.ts` with `isIpAddress`, `ipv4ToInAddrArpa`, `ipv6ToIp6Arpa` (full `::` expansion, nibble reversal), and `isArpaReverseName` (case-insensitive `*.in-addr.arpa.`/`*.ip6.arpa.` detection).
- [x] 1.2 Add `phoneToE164Arpa(phone: string): string | null` (strip non-digits, reverse, dot-join, append `e164.arpa`; `null` if no digits remain).
- [x] 1.3 Unit tests: IPv4 conversion, IPv6 conversion (RFC 3596 example + `::` shorthand), arpa passthrough, non-IP/non-arpa input returned unchanged (not an error), phone conversion, no-digit-phone error.

## 2. SRV and TLSA primitives

- [x] 2.1 Add `srvOwnerName(service, protocol, domain): string | null` to `queryTransforms.ts` (accepts service/protocol with or without a leading underscore; validates as DNS-label-safe tokens; returns `null` domain unchanged when both are empty).
- [x] 2.2 Add `tlsaOwnerName(port, transport, domain): string | null` (validates port 1-65535, transport as a label-safe token; returns domain unchanged when both are empty).
- [x] 2.3 Add `parseUrlForTlsa(input: string): { port: number; host: string } | null` (derives port 443/80 and host from `https://`/`http://` URLs).
- [x] 2.4 Unit tests: SRV owner construction (with/without leading underscore inputs), SRV pass-through when fields empty, TLSA owner construction, TLSA URL derivation, TLSA pass-through when fields empty and domain isn't a URL, invalid port rejected.

## 3. OPENPGPKEY/SMIMEA email-hash primitives

- [x] 3.1 Research RFC 7929 §3 and RFC 8162 §3 for the exact local-part canonicalization and hashing steps (do not assume — confirm case-folding/quoting behavior against the RFC text) and pull a worked test vector from each RFC's example section if one is published; do not fabricate expected hash values. (Fetched both RFCs; confirmed the shared worked example `hugh@example.com` → hash `c93f1e400f26708f98cb19d936620da35eec8f72e57f9eec01c1afd6`, independently recomputed via SHA-256 truncation.)
- [x] 3.2 Add `isEmailAddress(input: string): boolean` (single unquoted `@`, non-empty local-part and domain-part).
- [x] 3.3 Add async `openpgpkeyOwnerName`/`smimeaOwnerName` using `crypto.subtle.digest("SHA-256", ...)`, truncated to 28 octets, lowercase hex-encoded, prefixed as `._openpgpkey.`/`._smimecert.` + domain-part; surface a distinct error when `crypto.subtle` is unavailable (non-secure context). (Returns `{ queryName } | { error }` rather than `string | null` for a distinguishable error message, consistent with the rest of the module's return shape.)
- [x] 3.4 Unit tests: hash construction against the RFC test vector from 3.1, non-email input passed through unchanged, unavailable-crypto error path (stub `globalThis.crypto` without `.subtle`).

## 4. Dispatcher and engagement classification

- [x] 4.1 Add `engagedConvention(input): ConventionId | null` to `queryTransforms.ts` per design.md Decision 3's engagement rules table (PTR: IP-shaped; NAPTR: ENUM toggle on; SRV/TLSA: extra fields non-empty or TLSA URL; OPENPGPKEY/SMIMEA: `@` present). Keep this synchronous (no hashing) so it can drive UI disabling without an async round-trip.
- [x] 4.2 Add async `transformQueryInput(input): Promise<{ queryName: string } | { error: string }>` dispatching to the right primitive per the selected record type(s) and `engagedConvention` result.
- [x] 4.3 In `recordTypes.ts`, add the convention-to-record-type classification table (or reuse the one in `queryTransforms.ts`) so `app.tsx` doesn't hardcode record-type-name string checks.
- [x] 4.4 Unit tests: `engagedConvention` truth table across all six conventions plus the "nothing engaged" default case; `transformQueryInput` end-to-end for each convention plus the literal-owner passthrough case.

## 5. Form/persistence plumbing for convention extra state

- [x] 5.1 Add `enumMode: boolean`, `srvFields: { service: string; protocol: string }`, `tlsaFields: { port: string; transport: string }` to `LookupFormState` in `types.ts` (all optional/defaulted), and thread through `getLookupForm`/`saveLookupForm` in `lookupFormStore.ts`.
- [x] 5.2 Add the same optional fields to `QuickLookup`/`QuickLookupInput` and `LookupHistoryEntry` in `types.ts`, and persist/restore them in `quickLookupStore.ts` and `lookupHistoryStore.ts` (default to "not engaged" for older stored records missing the fields).
- [x] 5.3 Extend `LookupSetup` in `menu.tsx` with the same optional fields so quick-lookup and history re-runs can restore them via `applyLookupSetup`.

## 6. UI: query input preview and extra-field components

- [x] 6.1 Create `webapp/src/QueryInputPreview.tsx`: presentational component taking `{ recordTypes, domain, enumMode, srvFields, tlsaFields }`, calling `engagedConvention`/`transformQueryInput`, and rendering the convention-appropriate label/placeholder plus either the "Will query: ..." preview or an inline validation error. (Owns the domain `<label>`/`<input>` itself — the actual controlled input, not just a caption underneath — so the label/placeholder text has a single source of truth.)
- [x] 6.2 Create `webapp/src/SrvTlsaFields.tsx` with `SrvFieldsInput`/`TlsaFieldsInput`: optional Service/Protocol inputs shown only when `SRV` is selected, and optional Port/Transport inputs shown only when `TLSA` is selected.
- [x] 6.3 Add tests for `QueryInputPreview` covering: no convention engaged (default label, no preview), PTR engaged with valid/non-engaging IP, NAPTR with ENUM toggle on/off, SRV/TLSA with fields filled/blank, OPENPGPKEY with email-shaped/non-email input, the input's onChange wiring, and `onResultChange` reporting (null when not engaged, success/error results as the async transform resolves).
- [x] 6.4 Added `onResultChange` callback prop to `QueryInputPreview` so the parent form can proactively disable submission the moment the engaged convention's input becomes invalid, rather than only surfacing the error after a submit attempt (see 7.8).

## 7. Wire into the lookup form (`app.tsx`)

- [x] 7.1 Add `enumMode`/`srvFields`/`tlsaFields` state, initialized from `getLookupForm()`/`applyLookupSetup`, and persist them alongside `domain`/`selectedTypes` in the existing `saveLookupForm` effect.
- [x] 7.2 Compute `engagedConvention(...)` from current state; when non-null, render all other record-type checkboxes `disabled`. (Unchecked types are disabled; an already-checked incompatible type stays clickable so it can be unchecked — see 7.3.)
- [x] 7.3 If other types are already selected when a convention becomes engaged, show an inline message naming which types must be deselected and block submission (do not auto-clear selections) — implemented via a memoized `blockingTypes` list checked in `handleSubmit` and rendered inline; submit button also disabled while it's non-empty.
- [x] 7.4 Render the ENUM toggle only when `NAPTR` is selected, and `SrvFieldsInput`/`TlsaFieldsInput` only when `SRV`/`TLSA` are selected.
- [x] 7.5 Render `QueryInputPreview` (which owns the domain `<label>`/`<input>`) passing current selection and extra-field state.
- [x] 7.6 In `handleSubmit`/`executeLookup`, `await transformQueryInput(...)` before sending; on error, set `formError` and do not call `query()`; on success, send the resolved query name as `domain` while keeping the raw typed `domain` (and extra fields) for `saveLookupForm`/history/quick-lookup persistence.
- [x] 7.7 Apply the same transform-before-send step to the `pendingExecute` effect path (quick lookups / history re-run autoExecute), so programmatic execution validates and transforms identically to manual submit.
- [x] 7.8 Lift `QueryInputPreview`'s resolved transform result to `app.tsx` state (`previewResult`) via `onResultChange`, and disable the Submit button whenever it holds an error — so an invalid engaged-convention input (e.g. ENUM on with no digits, a lopsided SRV/TLSA field) blocks submission proactively, not just reactively after a click.

## 8. Verification

- [x] 8.1 Run `yarn vitest run` (or project equivalent) in `webapp/` and confirm all new and existing tests pass. (190/190 pass; `tsc --noEmit` clean; `yarn build` production bundle succeeds. `docs/app` build output reverted afterward — not part of this change.)
- [ ] 8.2 Manually exercise the app in a real browser: PTR with valid IPv4/IPv6/invalid/plain-hostname input; NAPTR with ENUM toggle on/off; SRV and TLSA with fields filled and blank, and with a pasted URL for TLSA; OPENPGPKEY/SMIMEA with an email address and with a plain hostname; confirm checkbox disabling/blocking behavior, preview text, and that history/quick-lookup entries show the original typed input while the backend receives the resolved query name. **Not done in this session** — no browser automation tool was available to drive the UI; needs a manual pass (`yarn dev` + a running `dns-backend`) before this task is considered complete.
