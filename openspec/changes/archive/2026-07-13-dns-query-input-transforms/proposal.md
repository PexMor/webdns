## Why

Several DNS lookup *conventions* build their query name (QNAME) from
human-friendly input rather than a literal domain: reverse DNS (`PTR` under
`in-addr.arpa`/`ip6.arpa`), ENUM (`NAPTR` under `e164.arpa`), SRV service
discovery (`_service._protocol.domain`), DANE/TLSA (`_port._transport.domain`),
and the email-hash conventions `OPENPGPKEY`/`SMIMEA`
(`<sha256-hash>._openpgpkey.domain` / `<sha256-hash>._smimecert.domain`).
Critically, **the RR type itself does not require this** — `PTR` can exist at
any ordinary name, plain `NAPTR`/`SRV`/`TLSA` queries against a literal owner
are valid and already work today. The transformation belongs to the
*application convention* layered on top, not to selecting the RR type. Today
the webapp has no tooling for any of these conventions: the single domain
field is always sent verbatim, so a user must already know (or hand-compute)
the constructed owner name for a reverse/ENUM/SRV/TLSA/email-hash lookup, and
nothing prevents combining a convention-driven query with unrelated record
types against the same literal input, which cannot produce a coherent
combined query once the owner name diverges from what was typed.

## What Changes

- Add pure/async helper functions per convention, each producing a
  `(queryName)` or a validation error from human-friendly input:
  - **Reverse DNS** (`PTR`): IPv4/IPv6 address → `in-addr.arpa`/`ip6.arpa`
    name, auto-detected from input shape (an already-qualified
    `*.in-addr.arpa`/`*.ip6.arpa` literal passes through unchanged; anything
    else is treated as a literal owner name — i.e. **PTR is not forced into
    reverse mode just by being selected**).
  - **ENUM** (`NAPTR`): phone number → `e164.arpa` name, gated behind an
    explicit "ENUM" toggle (phone-number shape is not reliably
    distinguishable from a domain, so this is opt-in, not auto-detected;
    plain `NAPTR` queries continue to work unchanged when the toggle is off).
  - **SRV**: optional service + protocol fields that, when filled in,
    prepend `_service._protocol.` to the domain; left blank, `SRV` queries
    the literal domain as today. A literal already-underscored owner typed
    directly is also detected and left alone.
  - **TLSA**: optional port + transport fields (or a pasted URL) that, when
    filled in, prepend `_port._transport.` to the domain; left blank, `TLSA`
    queries the literal domain as today.
  - **OPENPGPKEY** / **SMIMEA**: email address → SHA-256 hash of the
    canonicalized local-part (per RFC 7929 / RFC 8162) prepended as
    `<hash>._openpgpkey.<domain>` / `<hash>._smimecert.<domain>`, auto-detected
    when the input contains `@` (unambiguous vs. a DNS owner name); anything
    without `@` is treated as a literal owner name.
- Add a single async dispatch helper that, given the selected record type(s),
  the domain field, and any convention-specific extra fields, returns either
  the query name to send on the wire or a validation error.
- Add a helper that determines whether a convention transform is *currently
  engaged* for the active selection (not merely "is this RR type selected") —
  engagement depends on input shape/toggle/extra fields, per above. When a
  transform is engaged, the record type checkboxes for all other types are
  disabled (existing selections are not silently cleared; the user must
  deselect them, or submission is blocked with a clear message) since the
  resulting owner name no longer means "an ordinary hostname" for a combined
  query. When no transform is engaged, every record type remains freely
  combinable exactly as it is today.
- Add web components: a query-name preview under the domain input (label,
  placeholder, and "Will query: ..." preview or inline error, updating live)
  and the small optional extra-field groups for SRV (service/protocol) and
  TLSA (port/transport), shown only when those types are selected.
- Wire the transform into the existing submit path (`app.tsx` `handleSubmit`
  / `executeLookup`) so the resolved query name is what's sent over the
  WebSocket, while the user's original input (and any extra field values) is
  what's persisted to the lookup form, history, and quick lookups.

Explicitly out of scope for this change (may follow later): `URI`, generic
`SVCB`/`HTTPS` mapping-specific owner construction, and TXT-based application
conventions (DKIM, DMARC, ACME DNS-01, MTA-STS, BIMI) — these depend on
higher-level protocol support this webapp does not otherwise target yet.

## Capabilities

### New Capabilities
- `dns-query-input-transforms`: Helper functions and an async dispatch API
  that convert user-friendly input (IP address, phone number, service +
  protocol, port + transport, email address) into the DNS query names
  required for reverse DNS, ENUM, SRV, TLSA, OPENPGPKEY, and SMIMEA lookups
  (or pass through/report invalid input for a literal owner-name query), plus
  the "is a convention transform currently engaged" classification used to
  decide which record types can be combined in one query.

### Modified Capabilities
- `dns-web-client`: The DNS Query Form requirement gains convention-specific
  behavior: the domain input's label/placeholder and a live query-name
  preview adapt to the engaged convention (if any), optional extra fields
  appear for SRV/TLSA, submission uses the resolved query name in place of
  raw input when a convention is engaged, and the record type checkboxes
  disable selections that are incompatible with the currently engaged
  convention (with none of this applying when no convention is engaged).

## Impact

- `webapp/src/` — new `queryTransforms.ts` (helper functions + async
  dispatcher) and unit tests, including SHA-256 email hashing via the Web
  Crypto API for OPENPGPKEY/SMIMEA (requires a secure context — already an
  existing constraint elsewhere in the app); `recordTypes.ts` gains a lookup
  convention classification; `app.tsx` gains a query-name preview component,
  SRV/TLSA extra-field inputs, submit-time async transform call, and
  checkbox disable logic; no backend or wire-format changes (the resolved
  string still goes into the existing `domain` field of the WebSocket
  request).
- `lookupFormStore`, `lookupHistoryStore`, and `quickLookupStore` gain
  optional fields to persist convention-specific extra state (ENUM toggle,
  SRV service/protocol, TLSA port/transport) alongside the existing raw
  domain string, which remains the source of truth for what's displayed and
  re-editable — the resolved query name is never persisted.
