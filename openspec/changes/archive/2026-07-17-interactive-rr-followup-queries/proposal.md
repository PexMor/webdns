## Why

Today, discovering something useful in a DNS answer — an MX server's hostname, an A record's IP address, a SOA zone contact — means manually retyping it into the query form to look it up further. That's the most common next action after almost every lookup (chase an IP to its PTR name, chase a hostname to its A/AAAA, or email a zone's abuse contact), so the extra copy-paste round trip is pure friction on a tool whose entire job is fast DNS exploration.

## What Changes

- Parsed record fields whose value is an IPv4/IPv6 address (A, AAAA `address`) become clickable: clicking runs a new `PTR` lookup for that address and executes it immediately, the same way quick lookups and history re-runs already do.
- Parsed record fields whose value is a hostname used for further resolution (MX `exchange`, NS/CNAME/ANAME/PTR `target`, SOA `mname`, SRV/SVCB/HTTPS `target`, NAPTR `replacement`) become clickable: clicking runs a new `A` + `AAAA` lookup for that hostname and executes it immediately.
- Non-actionable placeholder values (e.g. SRV/NAPTR `.` meaning "not available") are never rendered as clickable.
- SOA's `rname` (responsible-party field, encoded in RFC 1035 domain-name form) additionally renders a decoded `mailto:` link next to its existing raw value, so the zone's abuse/admin contact can be copied or emailed directly instead of hand-decoding the encoded form.
- This is purely additive to the parsed view: raw view, the record type help modal, and unparsed/generic fallback rendering are all unaffected — clickable behavior only applies to successfully parsed fields in live/history results.

## Capabilities

### New Capabilities
- `rr-followup-actions`: defines which parsed field kinds are actionable (IP address, follow-up hostname, encoded email), what action each triggers (PTR re-query, A/AAAA re-query, mailto link), and the rules for when a field is excluded (placeholder/empty values, help-modal context).

### Modified Capabilities
- `dns-rr-parsed-view`: field metadata (`RrFieldMeta.kind`) gains new kinds beyond `duration-seconds` so specific per-type field definitions can flag a field as an IP address, a follow-up hostname, or an RFC 1035-encoded email, and `LabeledField` renders those kinds as interactive elements instead of plain text.
- `dns-web-client`: the Results Display requirement gains a follow-up-query interaction — clicking an actionable field re-uses the existing programmatic lookup execution path (the same one quick lookups/history re-runs use) to populate and submit a new query without the user retyping anything.

## Impact

- `webapp/src/rr/types.ts`, `webapp/src/rr/LabeledField.tsx`, `webapp/src/rr/FieldList.tsx`: new field `kind` values and click/link rendering.
- `webapp/src/rr/records/address.ts`, `name.ts`, `mx.ts`, `soa.ts`, `srv.ts`, `svcb.ts`, `naptr.ts`: mark relevant fields with the new `kind`s.
- `webapp/src/RecordResultCard.tsx`, `webapp/src/app.tsx`: thread a follow-up callback from the results section down to `LabeledField`, wired to the existing `applyLookupSetup`/`handleRunLookupSetup` auto-execute path.
- `webapp/src/RecordTypeHelpModal.tsx`: explicitly does not wire the follow-up callback (help examples are illustrative, not a real query context).
- No backend, wire-format, or persisted-schema changes.
