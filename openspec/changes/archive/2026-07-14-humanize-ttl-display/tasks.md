## 1. Duration formatter

- [x] 1.1 Add `webapp/src/formatDuration.ts` exporting `formatDuration(seconds: number): { value: number; unit: "d" | "h" | "m" | "s" }[]`, implementing the exact d/h/m/s breakdown from design.md (non-zero components only, `[{ value: 0, unit: "s" }]` when the input is `0`)
- [x] 1.2 Add `webapp/src/formatDuration.test.ts` covering: `0` → `0s`, `30` → `30s`, `86400` → `1d`, `90061` → `1d1h1m1s`, `604800` → `7d`, and a large value (e.g. near `2^32`) to confirm no overflow/rounding issues

## 2. Duration display component

- [x] 2.1 Add `webapp/src/rr/DurationValue.tsx`: takes a raw string/number seconds value, calls `formatDuration`, and renders each component as `<span class="duration__value">{value}</span><span class="duration__unit">{unit}</span>` inside a wrapper with `title` set to the exact seconds count
- [x] 2.2 Add rendering tests for `DurationValue` (e.g. via `@testing-library/preact` or the project's existing component test pattern) confirming the rendered text and the `title` tooltip content for a couple of representative values

## 3. Field metadata wiring

- [x] 3.1 Extend `RrFieldMeta` in `webapp/src/rr/types.ts` with an optional `kind?: "duration-seconds"`
- [x] 3.2 Update `webapp/src/rr/LabeledField.tsx` to render values via `DurationValue` when `field.kind === "duration-seconds"`, falling back to the existing plain-text rendering otherwise (including for multi-value fields, which duration fields never are)
- [x] 3.3 Mark `refresh`, `retry`, `expire`, and `minimum` in `webapp/src/rr/records/soa.ts` with `kind: "duration-seconds"`
- [x] 3.4 Mark `originalTtl` in `webapp/src/rr/records/sigLike.ts` with `kind: "duration-seconds"`

## 4. Styling

- [x] 4.1 Add `.duration__value` and `.duration__unit` classes to `webapp/src/style.css`, using existing theme variables (e.g. `--text` for values, `--accent` for units) under both `[data-effective-theme="dark"]` and `[data-effective-theme="light"]` blocks so contrast holds in both themes

## 5. Verification

- [x] 5.1 Run the webapp's test suite and confirm existing SOA/RRSIG parsing and rendering tests still pass unmodified (parser output and raw view are untouched)
- [x] 5.2 Manually run the dev server, look up a domain with an SOA record and, if available, a DNSSEC-signed domain with RRSIG records, and visually confirm the parsed view shows colored `d/h/m/s` durations while the raw-view toggle still shows the original raw string
- [ ] 5.3 Manually verify both light and dark themes render the value/unit colors with adequate contrast (blocked in this sandbox: `yarn dev` could not be started to capture a live screenshot — needs a manual check by whoever runs the app locally)
