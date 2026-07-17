## MODIFIED Requirements

### Requirement: Lookup History Persistence
The web client SHALL persist a bounded history of completed DNS lookups in IndexedDB. Each history entry SHALL store the domain, selected record types (ordered list), DNS server address (the config `address` key, e.g. `8.8.8.8` or `auto`), resolved DNS server IP used for the query, and an ISO-8601 timestamp of when the lookup was submitted. In demo mode, lookups replayed from the demo dataset SHALL be recorded and updated using the same rules as live lookups.

#### Scenario: Record lookup on success
- **WHEN** the user submits a lookup and the backend returns a response (including partial failures per record type)
- **THEN** a new history entry is appended with the domain, record types, DNS server address, resolved IP, and current timestamp

#### Scenario: Record lookup on transport error
- **WHEN** the user submits a lookup and the WebSocket returns a request-level error before any response payload
- **THEN** a history entry is still recorded with the attempted parameters and timestamp

#### Scenario: Demo replay records history
- **WHEN** demo mode replays a matching entry with stored results or `responseError`
- **THEN** a history entry is recorded or deduplicated using the same rules as a live lookup

#### Scenario: History retention limit
- **WHEN** the history exceeds 100 entries
- **THEN** the oldest entries are removed so at most 100 remain

#### Scenario: Deduplicate consecutive identical lookups
- **WHEN** a new lookup matches the most recent history entry (same domain, record types, and DNS server address)
- **THEN** the existing entry's timestamp is updated instead of creating a duplicate row

### Requirement: Lookup History Panel
The web client SHALL expose lookup history in a History panel accessible from the hamburger menu, listing entries newest-first with domain, record types, DNS server, and relative or absolute time. When demo data is loaded at startup and local history is empty, those entries SHALL appear in the History panel without requiring a manual import.

#### Scenario: Open history panel
- **WHEN** the user opens the hamburger menu and selects History
- **THEN** a panel displays the persisted lookup history or an empty-state message when no lookups have been made

#### Scenario: Demo data pre-populates history
- **WHEN** demo mode loads a valid demo file and IndexedDB history is empty
- **THEN** the History panel lists the demo entries as if the user had imported them

#### Scenario: Re-run from history
- **WHEN** the user selects a history entry
- **THEN** the main form is populated with that entry's domain and record types, the DNS server selector is set to that entry's DNS server address (or nearest available match), the menu closes, and the lookup is executed immediately if the WebSocket is connected (or replayed immediately in demo mode)

#### Scenario: Clear history
- **WHEN** the user chooses Clear History in the History panel and confirms
- **THEN** all history entries are removed from IndexedDB and the panel shows the empty state
