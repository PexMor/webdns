## Context

The parsed-record rendering pipeline is: `RecordResultCard` → `RrRecordView` → `entry.View(fields, detailLevel, value)` (almost always the shared `FieldList`) → `LabeledField` per field. Field metadata (`RrFieldMeta`) already carries an optional `kind` used today only for `"duration-seconds"`. Separately, `app.tsx` already has a fully general "populate form and execute" path: `applyLookupSetup(setup)` with `autoExecute: true` sets `pendingExecute`, which an effect picks up and calls `executeLookup`. `handleRunLookupSetup(setup: LookupSetup)` is the thin wrapper already used by quick lookups and history re-runs to trigger this. `RecordResultCard` is rendered from two call sites in `app.tsx` (live `response.results` and `viewingHistoryEntry.results`); `RecordTypeHelpModal` reuses the same `entry.View` for a single representative example with no query context.

This design reuses both existing mechanisms rather than inventing new ones: `kind` gets new values, and clicks call `handleRunLookupSetup` through a threaded-down callback.

## Goals / Non-Goals

**Goals:**
- Clicking an IP address in a parsed result runs a `PTR` lookup for it; clicking a follow-up hostname runs `A`+`AAAA`; both execute immediately (no extra "confirm" step), matching the existing quick-lookup/history-rerun UX.
- Clicking works identically for live results and history-viewed results.
- SOA `rname` gets a `mailto:` link decoded from its RFC 1035 encoding, additive to (not replacing) the existing raw-looking field value.
- No behavior change when no follow-up handler is supplied (help modal) — fields render exactly as before.
- Zero backend/wire changes; this is presentation + event wiring only.

**Non-Goals:**
- No follow-up actions on `SVCB`/`HTTPS` params other than `ipv4hint`/`ipv6hint` (e.g. `alpn`, `port`, `ech` stay plain text), and no attempt to make every possible embedded-token case interactive (e.g. NAPTR's `regexp` field, which can itself embed a URI, is out of scope).
- No "open in new tab" / multi-result-panel UX; a follow-up click replaces the current form's domain/record-types and executes, same as any other programmatic lookup trigger. It does not preserve the previous result on screen beyond however the app already handles a new response replacing the old one.
- No configurability (e.g. a setting to disable click-to-query) — this ships as always-on interactive behavior, consistent with how raw/parsed toggle has no off switch either.
- No change to what counts as "engaged" query-name conventions (`dns-query-input-transforms`) — a follow-up click sets plain record types (`PTR`, or `A`+`AAAA`) against a literal domain/address, which never engages a convention itself (e.g. clicking an address does route through `PTR`'s existing IP-shaped-input convention, which is fine and desired — it's the same transform a manual `PTR` lookup on that address would get).

## Decisions

**Extend `RrFieldMeta.kind` with `"ip-address"`, `"hostname"`, and `"email-encoded"` rather than a new parallel metadata field.**
`kind` already exists precisely to let `LabeledField` special-case rendering per field (see `duration-seconds`). Adding more union members is the smallest change and keeps all per-type field definitions (`address.ts`, `mx.ts`, `soa.ts`, `name.ts`, `srv.ts`, `svcb.ts`, `naptr.ts`) as pure data edits — no new plumbing per record type.

**Thread a single optional `onFollowUp?: (setup: FollowUpQuery) => void` prop down through `RrRecordView` → `View` → `FieldList` → `LabeledField`, rather than baking query-execution logic into `rr/`.**
The `rr/` module is currently decoupled from `app.tsx`/query execution entirely (it only knows about strings in, JSX out). Keeping it that way means `LabeledField` just needs to know "call this callback with a domain + record types" — it doesn't need to know about WebSocket state, DNS servers, or history. `FollowUpQuery` is a small subset of the existing `LookupSetup` shape (`{ domain, recordTypes }`); `RecordResultCard` (or `app.tsx`, wherever it's simplest to close over `handleRunLookupSetup`) adapts it to a full `LookupSetup` with `autoExecute: true` and calls `handleRunLookupSetup`.
Alternative considered: pass `getRrTypeEntry`-registered views a live "app context" object. Rejected — much larger surface change for no benefit; a single callback prop is enough.

**Derive the click action from `kind`, not from a new per-field "action" property.**
`ip-address` always means "run PTR"; `hostname` always means "run A+AAAA". No field needs a different action than what its kind implies, so encoding the action in the kind (rather than a separate `action: "ptr" | "a-aaaa"` field) avoids a redundant piece of metadata that could drift out of sync.

**Placeholder detection (`.` / empty) lives in `LabeledField`, applied uniformly to any `hostname`-kind field, not per record type.**
`.` as "not available" is a shared DNS presentation-format convention (SRV, NAPTR, SVCB/HTTPS all use it), so one shared guard (`value === "." || value.trim() === ""`) in the rendering component is simpler and safer than remembering to special-case it in every `records/*.ts` file that could produce it.

**SOA `rname` decoding is a pure function (`decodeSoaRname(rname: string): string | null`) called directly by the `SOA` field definition/view, not a generic `email-encoded` decoder invoked by `LabeledField` for arbitrary future record types.**
RFC 1035 rname encoding (first *unescaped* dot = local/domain separator, `\.` is a literal dot) is specific enough that it's worth a small dedicated helper (colocated in `soa.ts` or `rr/records/soa.ts`'s module) rather than generic string munging in the shared `LabeledField`. `LabeledField` still owns *rendering* the result (raw value + optional mailto link) via the `email-encoded` kind, but the decode function is supplied by/for `soa.ts` specifically — kept as a small exported helper so it stays unit-testable in isolation (mirrors the existing pattern of colocated parse helpers like `tokenize`/`isInteger`).

**A follow-up click always executes immediately (`autoExecute: true`), with no intermediate "review before sending" step.**
Matches existing product behavior: quick lookups and history re-runs already auto-execute. Introducing a different (non-auto-executing) interaction pattern just for this feature would be inconsistent and add a decision point the user didn't ask for. The existing lookup form still updates to reflect what was queried (visible domain/record-type state), so the action is transparent, not a hidden side-query.

**Follow-up wiring is omitted entirely (prop left `undefined`) in `RecordTypeHelpModal`, rather than passed a no-op.**
`LabeledField` already needs an "is this handler present" branch to fall back to plain text (needed anyway for testability and for any future context without query execution), so there is no extra code required to keep the help modal inert — it simply never passes the prop.

**TXT (SPF) and SVCB/HTTPS `params` get bespoke `View` components (`TxtView`, `SvcbView`) instead of extending `FieldList`/`LabeledField` to understand sub-tokens within a field value.**
Both of these are qualitatively different from the whole-field-value model the rest of the system uses: an SPF string is one field whose *individual mechanisms* need independent click targets, and an SVCB/HTTPS `params` array holds heterogeneous `key=value` tokens where only `ipv4hint`/`ipv6hint` are actionable. Rather than teaching the generic components a sub-tokenizing concept that only two record types need, each gets its own small `View` (already an explicitly supported extension point per `dns-rr-parsed-view`'s "dedicated display component per record type family"). Both reuse the exported `FollowUpValue` component (extracted from `LabeledField` for exactly this purpose) to render each embedded clickable token, so the actual click/styling behavior stays identical to whole-field follow-ups. `TxtView` and `SvcbView` still delegate to `LabeledField` for their non-tokenized fields (`Priority`, `Target`, and the plain-text TXT fallback), so only the genuinely new part is new code.

**SPF mechanism parsing (`parseSpfTerms`/`parseSpfTerm` in `rr/records/spf.ts`) is a small dedicated tokenizer, not a reuse of the shared `tokenize()` helper.**
`tokenize()` is built for space/quote-delimited RDATA fields (SOA, MX, ...) where each token is a positional value. SPF terms have their own micro-grammar (optional qualifier, mechanism name, `:`/`=` separator, value, optional CIDR suffix) that doesn't fit that model, and `ip6:` values themselves contain colons that must not be treated as a second separator. Only terms naming a literal, non-macro domain or address become clickable (`a`, `mx`, `include`, `exists`, `redirect=`, `ip4`, `ip6`); bare keyword mechanisms (`mx`, `a`, `all` and its qualified forms `-all`/`~all`/`+all`/`?all`) and macro-letter domain-specs (e.g. `exists:%{i}.example.com`) render as plain text since they don't name a resolvable value.

**Fixed `parseTxt` to stop splitting an unquoted TXT value on whitespace.**
While manually verifying the SPF feature against a real backend, an unquoted single-segment TXT answer (e.g. `v=spf1 mx a:mail.example.com -all`, with no surrounding `"..."`) was found to already split into one array entry per word, via the shared `tokenize()` helper's unconditional whitespace-splitting. This is a pre-existing bug (not introduced by this change) that happens to have been latent until this feature needed to reassemble the full SPF text from `TxtFields.strings`. Fixed by only using `tokenize()`'s quote-aware splitting when the raw value actually contains a `"` (i.e. is genuinely one-or-more quoted character-strings per RFC 1035); an unquoted value is now kept as a single string, preserving its internal spaces. Quoted single- and multi-segment inputs are unaffected (existing tests for both still pass unchanged).

## Risks / Trade-offs

- **Accidental clicks triggering an unwanted network lookup** → Mitigated by using a clearly-styled clickable affordance (consistent with the existing `rr-view-toggle` button styling language) rather than making entire rows silently clickable, and by the action being cheap/reversible (another DNS lookup, not a destructive action).
- **`.` / empty placeholder detection missing a record-type-specific edge case not yet covered** → Scoped narrowly: only exact `.` or empty/whitespace-only values are excluded; anything else renders clickable. If a new placeholder convention shows up later it's a one-line addition to the shared guard.
- **SOA rname decoding producing a wrong-looking email for zones with unusual encoding (e.g. multiple escaped dots, or a local part containing other escaped specials like `\@`)** → Scope the decoder to the documented RFC 1035 case (first unescaped dot = separator, `\.` = literal dot) and fall back to "no mailto link" (raw value only) for anything that doesn't cleanly decode, rather than guessing — covered by the spec's "cannot be decoded" scenario.
- **Coupling `rr/` (currently query-execution-agnostic) to app-level query semantics via the callback prop** → Kept minimal: the prop type is just `{ domain: string; recordTypes: string[] }`, no WebSocket/store types leak into `rr/`.
- **SPF grammar edge cases not covered by `parseSpfTerm` (e.g. `ptr:`, macro letters beyond a bare `%{i}` check, `exp=`/other modifiers) silently render as plain text** → Intentional fail-safe default: an unrecognized or ambiguous term is left non-actionable rather than guessing at a target, so the worst case is "one fewer clickable token," never a wrong follow-up query.
- **The unquoted-vs-quoted TXT heuristic (`raw.includes('"')`) misclassifies a value that legitimately contains a literal `"` without being RFC 1035-quoted** → Accepted: real-world unquoted TXT content containing a bare double-quote character is vanishingly rare compared to the common case this fixes (unquoted SPF/DKIM/verification strings), and the failure mode (falling back to the pre-existing quote-aware tokenizer) is no worse than the bug being fixed.

## Migration Plan

Purely additive UI change behind no flag; ships in one PR. No data migration, no backend changes, no rollback complexity beyond a normal revert.
