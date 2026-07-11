## Purpose

Named quick lookup presets in the web client.

## Requirements

### Requirement: Quick Lookup Persistence
The web client SHALL store user-defined quick lookup presets in IndexedDB. Each preset SHALL have a unique `id`, a user-visible `name`, `domain`, `recordTypes` (non-empty array), `dnsServerAddress` (config address key), and `sortOrder` (integer for menu ordering).

#### Scenario: Create quick lookup from current form
- **WHEN** the user opens Manage Quick Lookups, enters a name, and saves while the main form has a domain and at least one record type selected
- **THEN** a new preset is persisted with the current domain, record types, selected DNS server address, and appended to the sort order

#### Scenario: Name required
- **WHEN** the user attempts to save a quick lookup without a name
- **THEN** the client prevents save and indicates that a name is required

### Requirement: Quick Lookup Menu Access
The web client SHALL list saved quick lookups in the hamburger menu root navigation (below existing entries), showing each preset by its `name`.

#### Scenario: Menu shows quick lookups
- **WHEN** the user opens the hamburger menu and one or more quick lookups exist
- **THEN** each quick lookup appears as a selectable menu item labeled with its name (e.g. `A+AAAA+MX cvut.cz`)

#### Scenario: Execute quick lookup from menu
- **WHEN** the user selects a quick lookup from the menu
- **THEN** the main form is populated with the preset's domain and record types, the DNS server selector is set to the preset's DNS server address (or nearest available match), the menu closes, and the lookup is executed immediately if the WebSocket is connected

#### Scenario: Quick lookup with unavailable DNS server
- **WHEN** a quick lookup references a DNS server address that is no longer in the available options
- **THEN** the client applies the preset's domain and record types, falls back to the current default DNS server, shows a brief notice that the saved resolver was unavailable, and still executes the lookup

### Requirement: Quick Lookup Management Panel
The web client SHALL provide a Manage Quick Lookups panel (accessible from the hamburger menu) to rename, reorder, delete, import, and export presets.

#### Scenario: Rename quick lookup
- **WHEN** the user edits a preset's name in the management panel and saves
- **THEN** the updated name is persisted and reflected in the menu

#### Scenario: Delete quick lookup
- **WHEN** the user deletes a preset
- **THEN** it is removed from IndexedDB and no longer appears in the menu

#### Scenario: Reorder quick lookups
- **WHEN** the user moves a preset up or down in the management panel
- **THEN** `sortOrder` values are updated and the menu reflects the new order

#### Scenario: Export quick lookups
- **WHEN** the user chooses Export JSON in the management panel
- **THEN** the browser downloads a JSON file containing all presets (`name`, `domain`, `recordTypes`, `dnsServerAddress`)

#### Scenario: Import quick lookups
- **WHEN** the user imports a valid JSON array of quick lookup objects
- **THEN** new presets are added (skipping duplicates by name), existing presets are not overwritten, and the user sees a summary of added and skipped counts
