## MODIFIED Requirements

### Requirement: Hamburger Menu Navigation
The web client SHALL provide a top-right hamburger menu that opens a panel with access to saved quick lookups (listed by name when present), History, Settings, DNS Server Management, Manage Quick Lookups, Mail DNS check, and About.

#### Scenario: Open menu
- **WHEN** the user clicks the hamburger icon in the top-right corner
- **THEN** a menu panel opens with entries for any saved quick lookups, History, Settings, Manage DNS Servers, Manage Quick Lookups, Mail DNS check, and About

#### Scenario: Close menu
- **WHEN** the menu is open and the user clicks outside the panel or presses Escape
- **THEN** the menu closes

#### Scenario: Open Mail DNS check
- **WHEN** the user selects Mail DNS check from the hamburger menu
- **THEN** the menu panel shows the mail DNS check setup form (domain and DKIM selectors) with a Run action

### Requirement: Mail DNS Check Full-Screen View
When a mail DNS check report is active (per the `mail-dns-check` capability), the web client SHALL hide the standard DNS query form and lookup results and SHALL show only the full-screen mail DNS check report until the user dismisses it.

#### Scenario: Main lookup hidden during report
- **WHEN** a mail DNS check report is being displayed
- **THEN** the ordinary query form, live results, and history-detail overlays are not visible

#### Scenario: Return to lookup after dismiss
- **WHEN** the user dismisses the mail DNS check report
- **THEN** the standard DNS query UI is restored with its prior form state unchanged
