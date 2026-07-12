## ADDED Requirements

### Requirement: Duration Field Formatting
The web client SHALL render any parsed field flagged as a seconds-valued duration (at minimum: SOA's `refresh`, `retry`, `expire`, `minimum`, and RRSIG/SIG's `originalTtl`) as a compact, exact `d`/`h`/`m`/`s` breakdown (e.g. `86400` renders as `1d`, `90061` renders as `1d1h1m1s`, `0` renders as `0s`) instead of the raw integer, with the numeric value and its unit letter visually distinguished by color, and SHALL leave non-duration fields (e.g. serial numbers, algorithm identifiers) and the raw answer string unaffected.

#### Scenario: Large SOA interval renders compactly
- **WHEN** a parsed SOA record's `refresh` field has raw value `86400`
- **THEN** the field list shows `1d` instead of `86400`, with the digit and the unit letter styled in distinct colors

#### Scenario: Mixed-magnitude value renders full breakdown
- **WHEN** a duration field has raw value `90061`
- **THEN** the client renders `1d1h1m1s`, omitting no non-zero component and introducing no rounding

#### Scenario: Zero-valued duration field
- **WHEN** a duration field has raw value `0`
- **THEN** the client renders `0s` rather than an empty string

#### Scenario: Exact seconds available on demand
- **WHEN** the user hovers (or otherwise inspects) a rendered duration value
- **THEN** the client exposes the original exact seconds count (e.g. via a tooltip) without requiring the user to switch to raw view

#### Scenario: Raw view unaffected
- **WHEN** the user toggles a record containing duration fields to raw view
- **THEN** the client shows the original, unmodified raw answer string with its literal numeric values, not the humanized breakdown

#### Scenario: Non-duration numeric field unaffected
- **WHEN** a parsed field is a plain numeric value not flagged as a duration (e.g. SOA's `serial`, RRSIG's `keyTag`)
- **THEN** the client renders it as the plain raw value, without duration formatting or unit letters
