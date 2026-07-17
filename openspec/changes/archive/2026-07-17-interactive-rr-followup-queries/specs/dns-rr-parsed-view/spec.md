## ADDED Requirements

### Requirement: Actionable Field Kind Rendering
The web client's field metadata SHALL support flagging a field as one of the actionable kinds `ip-address`, `hostname`, or `email-encoded` (in addition to the existing `duration-seconds` kind), and the shared field-rendering components (`FieldList`/`LabeledField`) SHALL render fields carrying these kinds as interactive elements — a clickable follow-up trigger for `ip-address`/`hostname`, and a decoded `mailto:` link alongside the raw value for `email-encoded` — when an interaction handler is supplied, instead of plain text.

#### Scenario: Field kind renders as an interactive element when a handler is supplied
- **WHEN** a parsed record view renders a field flagged `ip-address` or `hostname` and the caller has supplied a follow-up handler
- **THEN** the client renders that field's value as a clickable element rather than plain text

#### Scenario: Field kind renders as plain text when no handler is supplied
- **WHEN** a parsed record view renders a field flagged `ip-address` or `hostname` and no follow-up handler has been supplied (e.g. in the record type help modal)
- **THEN** the client renders that field's value as plain, non-interactive text, identical in appearance to an unflagged field

#### Scenario: Raw view is unaffected by actionable field kinds
- **WHEN** the user toggles a record containing actionable fields to raw view
- **THEN** the client shows the original, unmodified raw answer string, with no clickable elements or mailto links
