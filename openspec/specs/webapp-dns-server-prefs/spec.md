## Purpose

User-managed DNS server preferences in the web client.

## Requirements

### Requirement: Custom DNS Server Storage
The web client SHALL store user-added DNS servers in IndexedDB and include them alongside config.json defaults in the DNS server picker.

#### Scenario: Add a custom DNS server
- **WHEN** the user adds a DNS server with a valid IPv4 or IPv6 address via the settings UI
- **THEN** the server is persisted in IndexedDB and appears in the DNS server selection list

#### Scenario: Duplicate address rejected
- **WHEN** the user attempts to add a DNS server address that already exists (in config defaults or IndexedDB)
- **THEN** the client shows an error and does not create a duplicate entry

#### Scenario: Remove a custom DNS server
- **WHEN** the user removes a custom DNS server from the management UI
- **THEN** the entry is deleted from IndexedDB and no longer appears in the picker

### Requirement: DNS Server Import
The web client SHALL allow importing custom DNS servers from a JSON file containing an array of objects with at least an `address` field and optional `label` field.

#### Scenario: Successful import
- **WHEN** the user selects a valid JSON file with DNS server entries
- **THEN** new entries are added to IndexedDB, duplicates are skipped, and the user sees a summary of added and skipped counts

#### Scenario: Invalid import file
- **WHEN** the user selects a file that is not valid JSON or does not match the expected array shape
- **THEN** the client shows an error and makes no changes to IndexedDB

### Requirement: DNS Server Export
The web client SHALL allow exporting all custom (IndexedDB-stored) DNS servers as a downloadable JSON file.

#### Scenario: Export custom servers
- **WHEN** the user triggers export from the DNS server management UI
- **THEN** the browser downloads a JSON file containing all custom DNS server entries with `address` and optional `label` fields
