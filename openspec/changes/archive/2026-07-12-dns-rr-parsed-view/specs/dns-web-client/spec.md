## MODIFIED Requirements

### Requirement: Results Display
The web client SHALL render the backend's response grouped by record type, showing parsed, per-record-type views (per the `dns-rr-parsed-view` capability) for successful lookups by default, with a per-record toggle to the original raw answer string, and a visible error indicator for record types that failed to resolve, without one failed record type hiding the results of others.

#### Scenario: Mixed success and failure response
- **WHEN** the client receives a response where some record types have results and others have an `error` field set
- **THEN** the client displays the successful records in parsed form (or raw, if toggled or unparseable) and clearly marks the failed record types with their error message, in the same view

#### Scenario: Parsed view by default
- **WHEN** the client receives a successful lookup for a record type with a registered parser and display component
- **THEN** the client shows the parsed view by default rather than the raw answer string
