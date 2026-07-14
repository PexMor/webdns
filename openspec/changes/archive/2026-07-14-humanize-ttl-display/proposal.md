## Why

SOA records (refresh, retry, expire, minimum TTL) and RRSIG/SIG records (original TTL) currently display raw seconds counts like `86400` or `604800` in the parsed record view. These large integers are hard to scan and compare at a glance — the user has to mentally divide by 3600/86400 to understand "how long" a value actually is. Converting them to compact, colored `1d`, `2h30m`, `1w` style strings makes the parsed DNS record views meaningfully more readable without losing precision.

## What Changes

- Add a pure `formatDuration(seconds)` utility that converts an integer seconds count into a compact `Xd Xh Xm Xs`-style breakdown, omitting zero-valued components (e.g. `86400` → `1d`, `90061` → `1d1h1m1s`, `30` → `30s`, `0` → `0s`).
- Add a `DurationValue` display component that renders the formatted breakdown as alternating colored inline spans — one color for the numeric value, a distinct color for the unit letter — using the app's existing light/dark theme CSS variables, with the exact raw seconds count available via a `title` tooltip for precision.
- Extend the per-record-type field metadata (`RrFieldMeta`) with an optional field-kind flag so the shared `LabeledField`/`FieldList` renderer displays duration-kind fields via `DurationValue` instead of plain text, with no change to how raw record strings are parsed or stored.
- Mark SOA's `refresh`, `retry`, `expire`, and `minimum` fields, and RRSIG/SIG's `originalTtl` field, as duration-kind so they render humanized values in the parsed view by default.
- Add duration value/unit color classes to the stylesheet, theme-aware for both light and dark mode.
- The existing raw/parsed toggle is unaffected: switching a record to raw view still shows the original, unmodified raw answer string exactly as returned by the backend.

Out of scope: the backend does not currently send a per-record top-level TTL (`DnsRecordResult` only carries `record_type`, `records`, `error`), so there is no generic "TTL column" to format today. This change formats the seconds-based fields that already exist in parsed views (SOA + RRSIG/SIG). The field-kind flag is generic, so a future per-record TTL field can opt in with a one-line metadata change rather than new formatting code.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `dns-rr-parsed-view`: add a requirement that seconds-valued duration fields (SOA refresh/retry/expire/minimum, RRSIG/SIG originalTtl) render as a compact, colored, human-readable duration in the parsed view instead of a raw integer.

## Impact

- `webapp/src/rr/types.ts` — extend `RrFieldMeta` with a duration-kind flag
- `webapp/src/rr/LabeledField.tsx` — render duration-kind fields via `DurationValue`
- `webapp/src/rr/records/soa.ts` — mark refresh/retry/expire/minimum as duration-kind
- `webapp/src/rr/records/sigLike.ts` — mark originalTtl as duration-kind
- New `webapp/src/formatDuration.ts` — pure seconds → components formatter
- New `webapp/src/rr/DurationValue.tsx` — colored value/unit display component
- `webapp/src/style.css` — duration value/unit color classes for light/dark themes
- New/updated tests: `formatDuration.test.ts`, `LabeledField`/SOA rendering coverage
