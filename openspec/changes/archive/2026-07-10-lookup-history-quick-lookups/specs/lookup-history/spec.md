## ADDED Requirements

### Requirement: Lookup History Persistence
The web client SHALL persist a bounded history of completed DNS lookups in IndexedDB. Each history entry SHALL store the domain, selected record types (ordered list), DNS server address (the config `address` key, e.g. `8.8.8.8` or `auto`), resolved DNS server IP used for the query, and an ISO-8601 timestamp of when the lookup was submitted.

#### Scenario: Record lookup on success
- **WHEN** the user submits a lookup and the backend returns a response (including partial failures per record type)
- **THEN** a new history entry is appended with the domain, record types, DNS server address, resolved IP, and current timestamp

#### Scenario: Record lookup on transport error
- **WHEN** the user submits a lookup and the WebSocket returns a request-level error before any response payload
- **THEN** a history entry is still recorded with the attempted parameters and timestamp

#### Scenario: History retention limit
- **WHEN** the history exceeds 100 entries
- **THEN** the oldest entries are removed so at most 100 remain

#### Scenario: Deduplicate consecutive identical lookups
- **WHEN** a new lookup matches the most recent history entry (same domain, record types, and DNS server address)
- **THEN** the existing entry's timestamp is updated instead of creating a duplicate row

### Requirement: Lookup History Panel
The web client SHALL expose lookup history in a History panel accessible from the hamburger menu, listing entries newest-first with domain, record types, DNS server, and relative or absolute time.

#### Scenario: Open history panel
- **WHEN** the user opens the hamburger menu and selects History
- **THEN** a panel displays the persisted lookup history or an empty-state message when no lookups have been made

#### Scenario: Re-run from history
- **WHEN** the user selects a history entry
- **THEN** the main form is populated with that entry's domain and record types, the DNS server selector is set to that entry's DNS server address (or nearest available match), the menu closes, and the lookup is executed immediately if the WebSocket is connected

#### Scenario: Clear history
- **WHEN** the user chooses Clear History in the History panel and confirms
- **THEN** all history entries are removed from IndexedDB and the panel shows the empty state

### Requirement: Save History Entry as Quick Lookup
The web client SHALL allow promoting a history entry to a named quick lookup from the History panel.

#### Scenario: Promote to quick lookup
- **WHEN** the user chooses Save as Quick Lookup on a history entry and provides a name
- **THEN** a quick lookup preset is created with that name and the entry's domain, record types, and DNS server address
