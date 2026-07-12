## ADDED Requirements

### Requirement: Per-Record-Type Parsing
The web client SHALL parse each raw DNS answer string returned by the backend into a named-field structure specific to its record type, using a registry that maps record type to a parser, without requiring any backend or wire-format change.

#### Scenario: Recognized record type parses successfully
- **WHEN** a successful lookup returns one or more raw answer strings for a record type with a registered parser (e.g. MX, SOA, CAA, SRV)
- **THEN** the client derives a named-field structure for each answer (e.g. SOA yields `mname`, `rname`, `serial`, `refresh`, `retry`, `expire`, `minimum`) without altering the underlying raw string

#### Scenario: Unrecognized or unparseable record type
- **WHEN** a record type has no registered parser, or its raw answer string does not match the expected shape for its registered parser
- **THEN** the client treats that answer as unparsed and does not fabricate field values for it

### Requirement: Modular Per-Type Display Components
The web client SHALL render parsed DNS answers using a dedicated display component per record type family, and SHALL fall back to a generic label/value display for any answer that has no dedicated component or that failed to parse.

#### Scenario: Dedicated view for a parsed record
- **WHEN** an answer for a record type with both a registered parser and a registered display component is shown
- **THEN** the client renders that record's dedicated view with its named fields labeled individually, instead of the raw string

#### Scenario: Fallback view for unparsed record
- **WHEN** an answer has no registered display component, or its parser returned no result
- **THEN** the client renders the generic fallback view showing the raw string, instead of omitting the record or showing an error

### Requirement: Raw/Parsed Toggle
The web client SHALL let the user toggle each displayed DNS answer between its parsed view and the original raw answer string, in both the query results view and the record type help view, without losing access to the exact raw text the backend returned.

#### Scenario: Toggle to raw in results
- **WHEN** the user toggles a record shown in parsed form in the query results to raw
- **THEN** the client displays the original raw answer string for that record, unmodified

#### Scenario: Toggle to parsed in results
- **WHEN** the user toggles a record shown in raw form in the query results to parsed
- **THEN** the client displays the parsed view for that record if a parser and view are registered for its type, or the generic fallback view otherwise

#### Scenario: Toggle available in help view
- **WHEN** the user opens the record type help view for a type that has a registered parser and display component
- **THEN** the help view shows the same raw/parsed toggle as the results view, applied to that type's representative example

### Requirement: Record Type Help Reuses Parsed View
The web client's record type help view SHALL render its representative example for a record type using the same parser and display component used for live query results of that type, so the help view and live results stay visually consistent.

#### Scenario: Help example parses successfully
- **WHEN** the user opens help for a record type whose representative example string parses successfully
- **THEN** the help view shows the parsed view of that example by default, alongside the existing title and description text

#### Scenario: Help example fails to parse
- **WHEN** the user opens help for a record type whose representative example string does not parse (or has no registered parser)
- **THEN** the help view falls back to showing the example as raw text, without displaying broken or empty fields

### Requirement: Configurable Explanation Detail Level
The web client SHALL provide a persisted, user-configurable explanation detail level (at minimum: minimal, standard, detailed) that controls how much inline guidance is shown per field in parsed record views, applied consistently across the query results view and the record type help view.

#### Scenario: Changing detail level applies everywhere
- **WHEN** the user changes the explanation detail level
- **THEN** subsequently rendered parsed views in both the query results and the record type help view reflect the new detail level, and the choice persists across app reloads

#### Scenario: Minimal detail level
- **WHEN** the explanation detail level is set to minimal
- **THEN** parsed field views show field labels without additional explanatory text

#### Scenario: Detailed level on a field without authored detailed text
- **WHEN** the explanation detail level is set to detailed for a field that only has minimal/standard explanation text authored
- **THEN** the client shows the best available explanation for that field rather than an empty or broken explanation area
