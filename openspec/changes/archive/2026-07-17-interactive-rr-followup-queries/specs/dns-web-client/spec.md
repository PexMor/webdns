## MODIFIED Requirements

### Requirement: Results Display
The web client SHALL render the backend's response grouped by record type, showing parsed, per-record-type views (per the `dns-rr-parsed-view` capability) for successful lookups by default, with a per-record toggle to the original raw answer string, and a visible error indicator for record types that failed to resolve, without one failed record type hiding the results of others. Parsed fields flagged as actionable (per the `rr-followup-actions` capability) SHALL be clickable in both the live results view and the lookup history view, triggering a new lookup through the same programmatic lookup path used by quick lookups and history re-runs, without the user retyping the value.

#### Scenario: Mixed success and failure response
- **WHEN** the client receives a response where some record types have results and others have an `error` field set
- **THEN** the client displays the successful records in parsed form (or raw, if toggled or unparseable) and clearly marks the failed record types with their error message, in the same view

#### Scenario: Parsed view by default
- **WHEN** the client receives a successful lookup for a record type with a registered parser and display component
- **THEN** the client shows the parsed view by default rather than the raw answer string

#### Scenario: Follow-up action available in live results and history
- **WHEN** the user views a successful lookup's parsed results, whether from a live query or from re-opened lookup history
- **THEN** clickable actionable fields behave identically in both contexts, running and executing a new lookup via the same programmatic path
