## Context

The backend (`dns-backend/src/dns.rs`) resolves each record type via hickory-resolver and sends back `records: string[]`, where each string is hickory's RDATA `Display` output — the standard DNS zone-file presentation format (e.g. `10 mail.example.com.` for MX, `0 issue "letsencrypt.org"` for CAA, `ns1.example.com. admin.example.com. 2020010100 3600 900 604800 86400` for SOA). The frontend (`webapp/src/RecordResultCard.tsx`) currently renders these strings verbatim in a `<ul>`, and `webapp/src/recordTypeHelp.ts` / `RecordTypeHelpModal.tsx` show one static hard-coded example string per type. There are ~30 record types listed in `webapp/src/recordTypes.ts`, so this touches a meaningful number of hand-written parsers.

This is a frontend-only change. The wire format is stable presentation-format text per hickory's `RData::Display` impl, which is deterministic per record type and does not require a protocol change to parse.

## Goals / Non-Goals

**Goals:**
- Parse each record type's raw answer string into a named-field structure client-side.
- Render each record type with a dedicated, modular view component, with a generic fallback for unrecognized types or strings that fail to parse.
- Let the user toggle raw ⟷ parsed per record, in both the results view and the record type help modal.
- Support a configurable explanation detail level (minimal / standard / detailed) applied consistently in both places, persisted like other display prefs.
- Share the parser + view layer between live results and the static help example, so the help modal always reflects the real renderer.

**Non-Goals:**
- No backend or wire-format changes; `DnsRecordResult.records` stays `string[]`.
- No cryptographic decoding of binary blobs (DNSKEY public keys, RRSIG/SIG signatures, CERT/KEY payloads) beyond exposing them as labeled base64/hex fields — no signature verification or key parsing into curve parameters.
- No attempt to parse every conceivable resolver quirk or non-hickory presentation-format variant; the client only needs to match hickory-resolver's actual output, since that's the only backend it talks to.
- Not building a general zone-file parser; each RR type gets a narrow, purpose-built parser for its own field order.

## Decisions

### 1. Registry of per-type `{parse, View}` pairs, not a single generic parser
Each record type gets its own module under `webapp/src/rr/` exporting a parser function `(raw: string) => ParsedFields | null` and a Preact view component. A central registry (`webapp/src/rr/registry.ts`) maps `record_type` (upper-cased) to its entry. `RecordResultCard` and the help modal both look up the registry; if the type is missing from the registry, or `parse` returns `null` (unparseable string), they fall back to a shared generic view that just labels the whole string as "Raw value."
- Alternative considered: one big switch statement / parser function. Rejected — 30 types with different field shapes and explanation text is more maintainable as separate modules than one large function, and matches the proposal's "modular, per RR type" requirement directly.

### 2. Parsers are pure functions over the existing raw string, not a backend change
Parsing re-derives structure from `r.data.to_string()` output already sent by the backend, using per-type tokenizers (whitespace-splitting respecting quoted strings for TXT/CAA/NAPTR/HINFO, fixed positional fields for SOA/SRV/MX/CAA/SSHFP/TLSA/DS, parenthesis-continuation stripping for multi-line records like DNSKEY/RRSIG per hickory's formatting).
- Alternative considered: add structured JSON output from the backend (serialize each RData variant into named fields in Rust). Rejected for this change — larger blast radius (backend + wire format + versioning), and the presentation-format strings are already fully sufficient to reconstruct the fields deterministically. Left as a possible future change if parsing proves fragile in practice.

### 3. Field metadata (label + per-level explanation) lives next to the parser, not in a separate i18n-style table
Each RR module exports its field list as `{ key, label, explain: { minimal, standard, detailed } }[]` alongside the parser, so the parser's output shape and the view's labels/explanations can't drift apart silently.
- Alternative considered: one central `recordTypeHelp.ts`-style dictionary keyed by type+field. Rejected — with 30 types × several fields each, colocating keeps each type self-contained and reviewable in one file, and `recordTypeHelp.ts`'s existing per-type description/example continues to serve as the type-level (not field-level) blurb.

### 4. Raw/parsed toggle and detail level are both view-level state + a persisted default
- The raw/parsed toggle default (parsed-first) and the explanation detail level are persisted via a new `rrViewPrefsStore.ts`, following the existing `displayPrefsStore.ts` pattern (IndexedDB `prefs` store, `applyX`/`getX`/`saveX` functions, `document.documentElement.dataset` mirror if styling needs it).
- The per-record raw/parsed toggle itself is local component state (not persisted per-record) — only the *default* starting mode is a persisted preference, so users aren't surprised by a stale per-record override across sessions.
- Detail level is a single global preference (not per-type), consistent with the request that it be "configurable" without adding 30 separate settings.

### 5. Help modal reuses the same registry against the existing example string
`RecordTypeHelpModal` currently shows `help.example` (a full zone-file line like `example.com.  3600  IN  MX  10 mail.example.com.`) as inert text. The modal will extract the RDATA portion of that example (after the record type keyword) and run it through the same parser/view used for live results, with the same raw/parsed toggle and detail-level preference. If a type's hard-coded example doesn't parse (should not normally happen, since examples are authored to match hickory's format), it falls back to showing the example as raw text only, same as the generic fallback.
- Alternative considered: give each RR module its own hard-coded "sample parsed output" independent of `recordTypeHelp.ts`. Rejected — would duplicate the example data in two places and risk drifting from the real example shown elsewhere.

## Risks / Trade-offs

- **[Risk]** Hand-written parsers can drift from hickory's exact `Display` formatting for edge cases (escaped characters in TXT/HINFO character-strings, multi-string TXT records, parenthesis line-wrapping in DNSKEY/RRSIG/CERT/KEY/SIG). → **Mitigation**: parser returns `null` on anything it doesn't confidently recognize rather than guessing, so the UI degrades to the raw string instead of showing wrong labels; add unit tests per parser using real resolved output captured from the existing backend integration tests in `dns-backend/src/dns.rs` as fixtures.
- **[Risk]** 30 modular view components could balloon bundle size or dev effort. → **Mitigation**: share common presentational primitives (a `LabeledField` / `FieldList` component, common styling) across all RR views so each type module is mostly data (fields + parser), not new UI code.
- **[Risk]** Explanation text at three detail levels × ~30 types × several fields each is a lot of content to write and keep accurate. → **Mitigation**: minimal level can default to just the field label with no prose (already implicitly "done" for every field); standard/detailed are additive, so partial coverage degrades gracefully rather than breaking.
- **[Risk]** Reusing the help modal's static example through the live parser could surface a parser bug as a broken help screen for a type the user hasn't even queried yet. → **Mitigation**: same fallback-to-raw behavior applies there, so a parser miss shows the existing static example text, not an error.

## Open Questions

- None blocking; if a specific record type's presentation format turns out to be ambiguous during implementation (e.g. NAPTR's quoted-field escaping), the fallback-to-raw behavior means it can ship without a dedicated parser and be added later.
