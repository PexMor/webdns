## MODIFIED Requirements

### Requirement: DNS Query Form
The web client SHALL present a form allowing the user to enter a domain name and select one or more DNS record types (at minimum A, AAAA, MX, TXT, CNAME, NS), and SHALL submit a query to the backend over WebSocket when the user triggers a lookup. Connection settings (API key, WebSocket URL, DNS server) SHALL be managed via the hamburger menu Settings panel rather than inline on the main form. The form state SHALL be programmatically settable so quick lookups and history re-runs can pre-fill domain, record types, and DNS server before execution.

Record type selection SHALL be presented as a collapsed summary (selected types plus a control to change them) by default, both on initial load and after each successful lookup submission, unless the user has enabled the "keep record types expanded" preference in Settings, in which case the full selection UI SHALL remain expanded at all times instead of collapsing. Changing the selection from the collapsed summary SHALL open a dedicated full-screen record-type picker rather than expanding the selection inline within the query form, so that choosing types does not push the domain field or lookup results down the page. Each record-type control in the picker SHALL have a minimum touch target of 44x44 CSS pixels, consistent with mobile touch-target accessibility guidance, rather than a small native checkbox.

When a query-name-construction convention (reverse DNS, ENUM, SRV, TLSA, OPENPGPKEY, SMIMEA — per the `dns-query-input-transforms` capability) becomes engaged for the current selection and input, the client SHALL: adjust the domain field's label/placeholder to match the expected input, show a live preview of the query name that will actually be sent, disable selection of other record types for the duration of engagement, and submit the resolved query name in place of the raw input. Selecting one of these record types alone SHALL NOT change form behavior unless its convention is actually engaged — a plain `PTR`, `NAPTR`, `SRV`, `TLSA`, `OPENPGPKEY`, or `SMIMEA` query against a literal domain SHALL work exactly as any other record type does. The user's original raw input (and any convention-specific extra field values) SHALL still be what is persisted to the lookup form, history, and quick lookups — not the resolved query name.

#### Scenario: Submitting a query
- **WHEN** the user enters a domain and selects one or more record types and submits the form
- **THEN** the client sends a single WebSocket message matching the backend's expected request shape (`{domain, record_types, dns_server?}`)

#### Scenario: No record types selected
- **WHEN** the user attempts to submit without selecting any record type
- **THEN** the client prevents submission and indicates that at least one record type must be selected, without sending a WebSocket message

#### Scenario: Programmatic lookup execution
- **WHEN** a quick lookup or history re-run sets form state and requests execution
- **THEN** the client performs the same validation and WebSocket submission as a manual form submit, including recording the lookup in history on completion

#### Scenario: Selecting PTR alone does not change form behavior
- **WHEN** the user checks the `PTR` record type and the domain field contains an ordinary hostname (not an IP address)
- **THEN** other record types remain selectable, no query-name preview overrides the plain domain, and the query is sent exactly as typed

#### Scenario: IP-shaped input engages reverse DNS mode for PTR
- **WHEN** the user checks `PTR` and enters a valid IPv4 or IPv6 address in the domain field
- **THEN** other selected record types' controls become disabled, the domain field's preview shows the constructed `in-addr.arpa`/`ip6.arpa` query name, and submitting sends that constructed name while the address as typed is what is saved to lookup history

#### Scenario: Already-selected incompatible types block submission instead of being silently cleared
- **WHEN** other record types are already selected and a convention becomes engaged (e.g. the user types a valid IP with `PTR` and `A` both checked)
- **THEN** the client disables further selection of other types, displays a message identifying which currently-selected types must be deselected, and blocks submission until they are deselected or the convention becomes un-engaged

#### Scenario: Enabling ENUM mode for NAPTR engages the ENUM convention
- **WHEN** the user checks `NAPTR` and enables the ENUM/phone-number toggle
- **THEN** other record types' controls become disabled, the domain field switches to phone-number input mode with a query-name preview, and submitting sends the constructed `e164.arpa` query name

#### Scenario: Plain NAPTR selection does not engage the ENUM convention
- **WHEN** the user checks `NAPTR` without enabling the ENUM/phone-number toggle
- **THEN** other record types remain selectable and the domain field continues to behave as an ordinary hostname input

#### Scenario: SRV/TLSA extra fields engage their conventions only when filled in
- **WHEN** the user selects `SRV` (or `TLSA`) and enters a value in the optional Service/Protocol (or Port/Transport) fields
- **THEN** other record types' controls become disabled and the preview shows the constructed underscored query name; leaving those fields blank leaves other record types selectable and queries the literal domain

#### Scenario: Email-shaped input engages OPENPGPKEY/SMIMEA conventions
- **WHEN** the user selects `OPENPGPKEY` or `SMIMEA` and enters a value containing `@` in the domain field
- **THEN** other record types' controls become disabled and the preview shows the constructed hashed query name

#### Scenario: Invalid input blocks submission
- **WHEN** the current input cannot be resolved into a valid query name for the engaged convention (e.g. a phone number with no digits when ENUM mode is enabled, or an out-of-range TLSA port)
- **THEN** the client displays the validation error inline and does not submit a WebSocket message

#### Scenario: Record type selection starts folded
- **WHEN** the app loads and no prior in-session change has expanded the record type picker, and the "keep record types expanded" preference is off (the default)
- **THEN** the query form shows a collapsed summary of the currently selected record types instead of the full selection UI

#### Scenario: Record type selection re-folds after submission
- **WHEN** the "keep record types expanded" preference is off (the default) and the user submits a lookup from the full-screen record-type picker
- **THEN** the picker closes and the query form returns to showing the collapsed summary

#### Scenario: "Keep record types expanded" preference disables folding
- **WHEN** the user enables "keep record types expanded" in Settings
- **THEN** the record type selection UI remains expanded on load and after submitting lookups, instead of collapsing to a summary

#### Scenario: Opening the record-type picker
- **WHEN** the user taps the "Change" control on the collapsed record-type summary
- **THEN** a full-screen record-type picker opens showing all record type groups, without altering the domain field or any currently displayed lookup results underneath it

#### Scenario: Touch-friendly record type controls
- **WHEN** the record-type picker is open
- **THEN** each selectable record type control occupies at least a 44x44 CSS pixel tap target

### Requirement: Settings Panel
The web client SHALL provide a primary Settings panel (accessible from the hamburger menu) consolidating the connection and resolver settings the user changes most often — Server URL, WebSocket URL selection, DNS server selection, and the "keep record types expanded" preference — and SHALL provide a separate "Advanced settings" screen, reachable from the primary Settings panel, holding settings that are set once and rarely changed afterward: color theme, help example layout, record display mode, explanation detail level, custom DNS server management (add/list/import/export), API key, and connection headers management.

#### Scenario: Change WebSocket URL
- **WHEN** the user selects a different WebSocket URL in Settings
- **THEN** the client disconnects from the current WebSocket (if connected) and reconnects to the newly selected URL using stored connection headers

#### Scenario: Change DNS server
- **WHEN** the user selects a different DNS server in Settings
- **THEN** subsequent DNS queries include the selected server address in the WebSocket request

#### Scenario: Manage connection headers
- **WHEN** the user opens Advanced settings
- **THEN** a Connection headers section is available to add, edit, enable/disable, remove, import, and export header key-value pairs used for WebSocket authentication

#### Scenario: API key shortcut
- **WHEN** the user enters a value in the API key field in Advanced settings and clicks Connect
- **THEN** the client upserts the builtin `apikey` connection header and reconnects using all enabled headers

#### Scenario: Primary Settings screen omits rarely-changed controls
- **WHEN** the user opens Settings from the hamburger menu
- **THEN** the panel shows only Server URL, WebSocket URL, DNS server, and the "keep record types expanded" preference, plus a control to open Advanced settings — without theme, display/detail preferences, custom DNS server management, API key, or connection headers on that first screen

#### Scenario: Opening Advanced settings
- **WHEN** the user activates the Advanced settings control from the primary Settings panel
- **THEN** a new screen opens showing color theme, help example layout, record display mode, explanation detail level, custom DNS server management, API key, and connection headers

#### Scenario: Returning from Advanced settings
- **WHEN** the user is on the Advanced settings screen and activates its back control
- **THEN** the client returns to the primary Settings panel, not to the hamburger menu root
