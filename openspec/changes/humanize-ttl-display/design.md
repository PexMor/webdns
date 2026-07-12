## Context

The webapp's parsed record views (`webapp/src/rr/`) render DNS answers field-by-field via a shared `FieldList`/`LabeledField` pair, driven by per-record-type metadata (`RrFieldMeta[]`) registered in `webapp/src/rr/records/*.ts`. Several fields hold a raw seconds count: SOA's `refresh`, `retry`, `expire`, `minimum` (`webapp/src/rr/records/soa.ts`), and RRSIG/SIG's `originalTtl` (`webapp/src/rr/records/sigLike.ts`). These are parsed as plain strings and rendered as-is by `LabeledField` — there is no formatting layer today (`webapp/src/formatRecordResult.ts` only humanizes error strings, not numbers).

The app already has a theme system (`webapp/src/themeStore.ts`) driving `data-effective-theme="light"|"dark"` on `<html>`, with CSS custom properties (`--text`, `--muted`, `--accent`, etc.) defined per theme in `webapp/src/style.css`. Any new coloring must ride on these variables rather than hardcoded colors, so it stays correct in both themes.

The raw/parsed toggle (`dns-rr-parsed-view` capability) guarantees the raw view always shows the backend's unmodified answer string. Formatting must only touch the parsed view's rendering, never the underlying parsed value or the raw string.

## Goals / Non-Goals

**Goals:**
- Render known seconds-valued fields as a compact `1d2h3m4s`-style string instead of a raw integer, omitting zero components.
- Make the value and the unit letter visually distinct via color, consistent with light/dark theme.
- Keep the exact seconds count discoverable (tooltip) for users who want the precise number.
- Make adding a duration field to a new/existing record type a metadata-only change (no new component wiring per type).

**Non-Goals:**
- Adding a per-record top-level TTL column — the backend does not send one today (`DnsRecordResult` has no `ttl` field); out of scope per the proposal.
- Editable/interactive duration input (e.g. a TTL picker for queries) — display-only.
- Localized/verbose duration phrasing (e.g. "1 day, 2 hours") — the compact `1d2h` form is what was asked for.
- Changing the raw view or the underlying parsed string values.

## Decisions

**1. Field-kind flag on `RrFieldMeta` rather than per-field-name matching.**
Add an optional `kind?: "duration-seconds"` to `RrFieldMeta` (`webapp/src/rr/types.ts`). `LabeledField` checks `field.kind` and renders `DurationValue` instead of the plain-text span when set. Alternative considered: pattern-matching field labels/keys containing "ttl"/"seconds" — rejected as fragile (label text is presentation, not a contract) and it would silently mis-format non-duration numeric fields (e.g. `serial`, `algorithm`, `keyTag` are also integers but not durations).

**2. Pure formatter function, separate from the display component.**
`formatDuration(seconds: number): { value: number; unit: "d" | "h" | "m" | "s" }[]` in a new `webapp/src/formatDuration.ts`, unit-tested directly. `DurationValue.tsx` consumes the components and renders markup/color; it does no calculation itself. This mirrors the existing split between `rr/tokenize.ts` (pure parsing helpers) and the view components.

**3. Breakdown algorithm.**
Divide seconds into `d = floor(s/86400)`, `h = floor(remainder/3600)`, `m = floor(remainder/60)`, `s = remainder`, emitting only non-zero components in `d, h, m, s` order; if all components are zero, emit a single `0s`. No rounding — the breakdown is always exact, so no precision is lost converting `86461` → `1d1m1s`. Values are always non-negative integers per the existing SOA/RRSIG parsers' `isInteger` validation, so no sign or fractional-second handling is needed. Week-level (`w`) units were considered but rejected: DNS TTL/interval values conventionally cap expectations at day granularity (e.g. `604800` reads fine as `7d`), and adding a 5th unit increases decoding effort for the smaller benefit of shaving one character off a handful of values.

**4. Coloring by role (value vs. unit), not by component index.**
Each numeric part gets class `.duration__value`, each unit letter gets class `.duration__unit`; both map to existing theme variables (`--text` for values, `--accent` for units) added once in `style.css` under the existing `[data-effective-theme=...]` blocks. Alternative considered: cycling through multiple colors per component (day=color A, hour=color B, ...) — rejected as busier and harder to theme consistently (would need 4 new variables per theme instead of 2), and the value/unit contrast alone already achieves the requested "alter colors for values and the time unit" readability improvement.

**5. Precision preserved via `title` tooltip, not inline.**
`DurationValue` sets `title={`${seconds} seconds`}` on its wrapping `<span>`. Since the breakdown is always exact (decision 3), the tooltip is a convenience for users who want the raw number, not a correctness fallback. The raw/parsed toggle remains the way to see the literal backend string.

**6. No change to parsers.**
`parseSoa`/`parseSig` continue to return raw numeric strings; `DurationValue` does the `Number(value)` conversion at render time. Keeps parser output format uniform (`ParsedFieldValues` stays `Record<string, string | string[]>`) and avoids touching parser tests/snapshots.

## Risks / Trade-offs

- **Malformed/oversized numeric strings** (e.g. a 32-bit value near `4294967295`, ~136 years) → `formatDuration` must handle large inputs without special-casing; the same d/h/m/s division works unbounded, just yields a longer string (e.g. `49710d...`). No cap needed since SOA fields are already validated as integers by the parser.
- **Two-color contrast insufficient in some color-vision-deficiency cases** → Mitigation: colors are a secondary readability aid on top of the text itself (unit letters `d/h/m/s` are always present as literal characters), so the information is never color-only; this satisfies WCAG's "don't rely on color alone" guidance without extra work.
- **Tooltip-only precision may be missed by touch users** (no hover) → Mitigation: the raw/parsed toggle already exists as the discoverable, tap-friendly way to see the exact original string; the tooltip is a bonus for desktop users, not the only path to precision.

## Migration Plan

No data migration. This is a pure rendering-layer change:
1. Add `formatDuration.ts` + unit tests.
2. Add `DurationValue.tsx` + rendering tests.
3. Add `kind` to `RrFieldMeta` type; wire `LabeledField` to branch on it.
4. Add CSS classes/variables.
5. Mark the five known fields (`soa.ts` ×4, `sigLike.ts` ×1) with `kind: "duration-seconds"`.
Rollback is a plain revert; no persisted state or backend contract changes.

## Open Questions

None — scope, algorithm, and styling approach are settled above.
