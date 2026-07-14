## Context

The lookup form (`webapp/src/app.tsx`) has one free-text `domain` input and a
grid of record-type checkboxes (`RECORD_TYPE_GROUPS` in `recordTypes.ts`).
Today the same raw string is sent as `domain` for every selected type in one
WebSocket request (`useDnsSocket.query(domain, recordTypes, dnsServer)`), and
the backend never sees anything but that literal string.

An earlier revision of this design treated `PTR` and `NAPTR` as record types
that should always (`PTR`) or optionally-but-still-type-driven (`NAPTR`)
force a special input mode. That was wrong: **the RR type does not require a
constructed owner name — the application convention layered on top does.**
`PTR` can legally exist at any DNS name; plain `NAPTR`, `SRV`, and `TLSA`
queries against a literal owner are valid and already work. This design
corrects that by tying transforms to *conventions* (reverse DNS, ENUM, SRV
service discovery, TLSA/DANE, OPENPGPKEY, SMIMEA) that are each *engaged* by
specific, detectable conditions — not simply by selecting the associated RR
type.

## Goals / Non-Goals

**Goals:**
- Let a user type human-friendly input (IP address, phone number, service +
  protocol, port + transport, email address) and have the correct
  convention-specific query name computed and sent, with a live preview
  before submitting.
- Keep every record type's default behavior (literal owner name, freely
  combinable with any other type) unchanged from today, in every case where
  no convention is currently engaged.
- Prevent submitting a query that mixes an engaged convention (whose owner
  name no longer means "an ordinary hostname") with other record types
  against the same input.
- Keep the transform logic in small, testable functions, separate from
  Preact/JSX, even though some (email hashing) are necessarily async.

**Non-Goals:**
- No change to the WebSocket wire format — the resolved string is still sent
  as the existing `domain` field.
- No support in this change for `URI`, generic `SVCB`/`HTTPS` owner
  construction, or TXT-based application conventions (DKIM, DMARC, ACME
  DNS-01, MTA-STS, BIMI) — these need their own protocol-specific design work
  and are not part of this proposal.
- No backend changes; all resolution happens client-side before the request
  is sent.
- No attempt to defend against maliciously crafted RFC edge cases in
  local-part canonicalization beyond what RFC 7929/8162 specify — this is a
  lookup convenience tool, not a security boundary.

## Decisions

### 1. Transforms are keyed to *conventions*, not RR types, each with its own engagement rule

| Convention | RR type | Engagement rule | Trigger kind |
|---|---|---|---|
| Reverse DNS | `PTR` | input parses as a valid IPv4/IPv6 address, or is already a fully-qualified `*.in-addr.arpa`/`*.ip6.arpa` name | auto (unambiguous: no valid hostname is also a valid IP literal) |
| ENUM | `NAPTR` | explicit "ENUM" toggle is on | manual (phone-number shape is not reliably distinguishable from a domain) |
| SRV | `SRV` | the optional Service and/or Protocol fields are non-empty | manual (structured fields, additive) |
| TLSA | `TLSA` | the optional Port and/or Transport fields are non-empty, or the domain field is a parseable URL | manual (structured fields, additive) + auto for URL paste |
| OPENPGPKEY | `OPENPGPKEY` | input contains `@` | auto (unambiguous: `@` cannot appear in a DNS owner name) |
| SMIMEA | `SMIMEA` | input contains `@` | auto (same as OPENPGPKEY) |

When a type's engagement rule is *not* met, that type behaves exactly as it
does today: the literal domain field content is queried as the owner name,
freely combinable with any other type. Only when a rule *is* met does that
type's resolved query name diverge from the literal domain field, which is
what triggers exclusivity (Decision 3).

Literal-owner escape hatch: for `SRV`/`TLSA`, a user who already knows the
underscored owner name (`_sip._tcp.example.com`) can type it directly into
the domain field and leave the extra fields blank — the convention is not
engaged, and it queries exactly as typed, same as any other literal owner
lookup.

Rationale for auto vs. manual split: IP-literal shape and the presence of
`@` are both unambiguous with respect to valid DNS owner names, so
auto-detecting them carries no real risk of misinterpreting a hostname the
user actually meant literally. Phone-number shape is not similarly
unambiguous (digit-heavy strings can be valid, if unusual, hostnames), so
ENUM stays an explicit opt-in, matching the previous revision's reasoning.
SRV/TLSA use additive optional fields rather than a mode toggle because they
need genuinely new structured input (service+protocol, port+transport) that
doesn't fit in the single domain field at all; leaving the fields blank is
itself the "not engaged" state, so no separate toggle is needed.

### 2. Module shape: `webapp/src/queryTransforms.ts`, async-first dispatcher

Exports:
- `isIpAddress(input): boolean`, `ipv4ToInAddrArpa`, `ipv6ToIp6Arpa`,
  `isArpaReverseName` — reverse DNS primitives (sync).
- `phoneToE164Arpa(phone): string | null` — ENUM primitive (sync).
- `srvOwnerName(service, protocol, domain): string | null` — SRV primitive
  (sync): validates service/protocol as DNS-label-safe tokens, strips any
  leading underscore the user typed (so `sip`/`_sip` both work), joins as
  `_service._protocol.domain`.
- `tlsaOwnerName(port, transport, domain): string | null` — TLSA primitive
  (sync): validates `port` is 1-65535 and `transport` is a label-safe token
  (`tcp`/`udp`/etc.), joins as `_port._transport.domain`. A URL pasted into
  the domain field (e.g. `https://example.com`) is parsed for scheme-implied
  port (443/80) and host, handled by a small `parseUrlForTlsa(input)` helper.
- `isEmailAddress(input): boolean`, `openpgpkeyOwnerName(email): Promise<string | null>`,
  `smimeaOwnerName(email): Promise<string | null>` — email-hash primitives
  (async: use `crypto.subtle.digest("SHA-256", ...)` on the canonicalized
  local-part per RFC 7929 §3 / RFC 8162 §3, truncate to 28 octets, lowercase
  hex-encode, prepend `._openpgpkey.`/`._smimecert.` + domain). Requires a
  secure context; surfaces a clear error if `crypto.subtle` is unavailable
  (mirroring the existing `crypto.randomUUID` fallback pattern already used
  in `quickLookupStore.ts`, except there is no fallback for SHA-256 hashing —
  it is a hard requirement, so the error must say so plainly).
- `transformQueryInput(input): Promise<{ queryName: string } | { error: string }>`
  — the single entry point `app.tsx` calls before sending a query, taking the
  selected record types, the domain field, the ENUM toggle, and the SRV/TLSA
  extra fields, and dispatching to the right primitive per Decision 1's
  engagement rules.
- `engagedConvention(input): ConventionId | null` — pure, synchronous-safe
  read of "which convention (if any) is currently engaged," used for the
  checkbox-disabling UI without waiting on the async email-hash path (email
  engagement only needs the `@` shape check, not the hash itself, to know
  it's engaged).

Rationale for a single async-returning dispatcher (even though most branches
resolve synchronously): one call shape at the `app.tsx` call site, rather
than a sync/async split depending on which type is selected. The extra
`await` cost for non-email lookups is negligible (primitives resolve in the
same microtask).

Alternative considered: put transforms inside `useDnsSocket`'s `query()`
call. Rejected because `query()` is transport-focused and convention
semantics are a form/UI concern; keeping transforms upstream also lets the
preview UI call the same function without sending anything.

### 3. Exclusivity is driven by "is any convention currently engaged," not by RR type selection

`engagedConvention(selectedTypes, domain, enumMode, srvFields, tlsaFields)`
returns the engaged convention's id or `null`. When non-null:
- Every checkbox for a record type other than the engaged type's is rendered
  `disabled`.
- If other types were already checked before the convention became engaged
  (e.g. user had `A` + `PTR` checked, then typed a valid IP), they are
  **not** silently cleared — the form shows an inline message identifying
  which types must be deselected, and submission is blocked until the user
  deselects them or the convention becomes un-engaged (e.g. clears the IP,
  turns the ENUM toggle off, empties the SRV/TLSA fields).
- When `engagedConvention` is `null`, there is no special behavior at all:
  every type remains freely combinable, exactly as today.

Rationale for "disable + block, don't auto-clear": auto-detected engagement
(IP shape, `@` shape) can flip on a single keystroke; silently discarding
other checked types on every keystroke is surprising and can lose user
selections made moments earlier. Blocking submission with a clear message
gives the user control without data loss, while still satisfying "disable...
or refuse to check the incompatible ones."

### 4. New components

- `QueryInputPreview` — presentational, under the domain input. Shows the
  convention-appropriate label/placeholder (e.g. "IPv4 or IPv6 address",
  "Phone number", "Email address", or "Domain name" when nothing is
  engaged), and either "Will query: `<queryName>`" or an inline validation
  error. Calls `transformQueryInput` (debounced/memoized) on input change.
- `SrvFields` / `TlsaFields` — small optional-field groups (service +
  protocol / port + transport) rendered only when `SRV`/`TLSA` is among the
  selected types, feeding into the same `transformQueryInput` call.

Both are presentational (props in, JSX out), unit-testable the same way
`RecordTypeHelpModal.test.tsx` tests the existing help modal.

## Risks / Trade-offs

- **[Risk]** IPv6-to-arpa expansion has edge cases (`::`, mixed-case hex,
  embedded IPv4 tail, zone IDs). → Mitigation: reject rather than guess on
  ambiguous input; cover RFC 3596's worked example and common edge cases in
  unit tests.
- **[Risk]** RFC 7929/8162 local-part canonicalization details (case
  folding, quoting, internationalized local parts) are subtle enough that
  getting them wrong produces a query that silently never matches a real
  record. → Mitigation: implementation must pull the exact canonicalization
  steps and, if published, a worked test vector directly from RFC 7929 §3 /
  RFC 8162 §3 text rather than relying on this document's paraphrase (see
  tasks.md); do not fabricate expected hash values in tests.
- **[Risk]** `crypto.subtle` requires a secure context; some deployments of
  this app may be served over plain HTTP on a LAN. → Mitigation: surface a
  clear, actionable error ("Email-based lookups require HTTPS") rather than
  a cryptic failure; other record types remain unaffected.
- **[Risk]** Auto-detecting engagement from input shape (IP literal, `@`)
  means the record-type checkboxes can become disabled mid-keystroke as the
  user types. → Accepted per Decision 3's "disable + block, don't
  auto-clear" — no data loss, and the visual feedback is immediate and
  reversible.
- **[Trade-off]** SRV/TLSA optional fields add two more inputs to the form,
  but only rendered when those types are selected, so the common path (no
  SRV/TLSA selected) is unaffected.

## Migration Plan

No data migration: existing persisted `LookupFormState`/`QuickLookup`/
`LookupHistoryEntry` records simply lack the new optional convention fields
(ENUM toggle, SRV/TLSA extra fields), which default to "not engaged" /
empty, reproducing today's exact behavior for old saved entries.

## Open Questions

- Should a literal `*.e164.arpa` name typed directly (with ENUM toggle on)
  be detected and passed through unchanged, mirroring PTR's arpa passthrough?
  Deferred — not required by the examples driving this change.
- Should TLSA's URL-paste convenience also accept a bare `host:port` form
  (no scheme)? Deferred to implementation-time judgment; not a spec
  requirement in this change.
