## Purpose

Mail authentication and deliverability DNS audit for a domain: multi-step checks against authoritative nameservers, policy validation, and a shareable report.

## Requirements

### Requirement: Mail DNS Check Input
The web client SHALL provide a Mail DNS check workflow that accepts a domain name and a comma-separated list of DKIM selectors. DKIM selectors SHALL NOT be auto-discovered; when none are supplied, the check SHALL proceed with an empty selector list and emit a warning that DKIM cannot be verified.

#### Scenario: Valid input starts a check
- **WHEN** the user enters a non-empty domain and clicks Run while the WebSocket backend is connected
- **THEN** the client begins the mail DNS check orchestration for that domain and configured selectors

#### Scenario: Missing domain blocked
- **WHEN** the user attempts to run Mail DNS check with an empty domain
- **THEN** the client shows a validation error and does not send DNS queries

#### Scenario: Backend not connected
- **WHEN** the user attempts to run Mail DNS check while the WebSocket is not connected
- **THEN** the client shows a connection error and does not start the check

### Requirement: Authoritative Nameserver Discovery
The mail DNS check SHALL discover authoritative nameservers for the target domain by querying `NS` records via the client's configured default DNS resolver, then resolving each nameserver hostname to an IPv4/IPv6 address via `A`/`AAAA` queries on the same resolver.

#### Scenario: Nameservers discovered
- **WHEN** the domain has `NS` records and each nameserver hostname resolves
- **THEN** the check proceeds with a list of `{ hostname, ip }` pairs used for subsequent per-NS queries

#### Scenario: No resolvable nameserver IPs
- **WHEN** `NS` records exist but no nameserver hostname resolves to an IP
- **THEN** the report records an error that no authoritative nameserver IPs were found and skips per-NS consistency checks

### Requirement: Per-Nameserver Record Queries
For each discovered authoritative nameserver IP, the mail DNS check SHALL query that IP directly (via the backend's per-request `dns_server` field) for: apex `TXT` (SPF lines filtered to those containing `v=spf1`), `_dmarc.<domain>` `TXT`, `MX`, and for each configured DKIM selector both `TXT` and `CNAME` at `<selector>._domainkey.<domain>`.

#### Scenario: Direct NS query
- **WHEN** an authoritative NS has IP `203.0.113.1`
- **THEN** consistency-related queries for that NS are sent with `"dns_server": "203.0.113.1"`

#### Scenario: Non-SPF apex TXT ignored for SPF checks
- **WHEN** apex `TXT` includes both `v=spf1` and non-SPF strings (e.g. site verification)
- **THEN** only `v=spf1` lines are used for SPF consistency and policy checks

### Requirement: Cross-Nameserver Consistency
The mail DNS check SHALL compare normalized answers for SPF, DMARC, MX, and each DKIM selector's TXT and CNAME across all authoritative nameserver IPs. Mismatches SHALL be reported as errors; matches SHALL be reported as passed checks.

#### Scenario: Consistent SPF across NS
- **WHEN** every authoritative NS returns identical normalized SPF TXT after filtering
- **THEN** the report includes a passed check for SPF consistency and marks the consistency table row as consistent

#### Scenario: Inconsistent DMARC across NS
- **WHEN** two authoritative NS return different normalized DMARC TXT
- **THEN** the report includes an error for DMARC inconsistency and marks the consistency table row as inconsistent

### Requirement: MX Host Resolution and FCrdNS
The mail DNS check SHALL, using the default resolver, resolve each unique MX exchange hostname from the domain's MX records to `A` and `AAAA` addresses, then perform `PTR` lookups for each returned IP. Missing `A` records SHALL be errors; missing `PTR` SHALL be errors; PTR hostnames that do not match the MX hostname (forward-confirmed reverse DNS) SHALL be warnings.

#### Scenario: FCrdNS match
- **WHEN** MX host `mail.example.com` resolves to `198.51.100.1` and `PTR` for that IP is `mail.example.com`
- **THEN** the report marks FCrdNS as OK for that host

#### Scenario: FCrdNS mismatch
- **WHEN** the MX hostname's `A` record IP has a `PTR` pointing to a different hostname
- **THEN** the report includes a warning describing the FCrdNS mismatch

### Requirement: Mail Policy Validation
Beyond consistency, the mail DNS check SHALL validate mail authentication best practices: SPF present with a single `v=spf1` record and terminal qualifier heuristics (`-all` pass, `~all`/`?all`/missing qualifier warnings); DMARC present at `_dmarc.<domain>` containing `v=DMARC1` with `p=` policy heuristics (`p=none` warning, `p=quarantine`/`p=reject` pass, missing `rua=` warning); DKIM present (TXT or CNAME) for each supplied selector; MX records present.

#### Scenario: Strict SPF
- **WHEN** SPF ends with `-all`
- **THEN** the report includes a passed check for strict SPF qualifier

#### Scenario: Multiple SPF records
- **WHEN** more than one `v=spf1` line is present for a nameserver's apex TXT
- **THEN** the report includes an error that only one SPF record is allowed

### Requirement: Report Summary and Status
The mail DNS check SHALL produce a report with overall status `OK`, `WARNINGS`, or `ERRORS` (errors take precedence), counts of errors/warnings/passed checks, and sections for errors, warnings, authoritative nameservers, record consistency table, MX host resolution table, per-nameserver raw records, and passed checks — matching the structure documented in `tmp/01_dns_check.md`.

#### Scenario: Errors dominate status
- **WHEN** the check finds at least one error-level finding
- **THEN** overall status is `ERRORS`

#### Scenario: Warnings only
- **WHEN** the check finds warnings but no errors
- **THEN** overall status is `WARNINGS`

### Requirement: Full-Screen In-App Report
When a mail DNS check completes, the web client SHALL display the report in a dedicated full-screen view separate from the standard per-lookup results panel. The view SHALL include the domain, generation timestamp, a control to return to the main lookup UI, and a control to download the report as HTML.

#### Scenario: Report replaces main lookup view
- **WHEN** a mail DNS check finishes successfully
- **THEN** the client shows the full-screen report view instead of the ordinary lookup form and results

#### Scenario: Back dismisses report
- **WHEN** the user clicks Back on the report view
- **THEN** the client returns to the main lookup UI and clears the in-memory report view state

### Requirement: Self-Contained HTML Export
The web client SHALL allow downloading the mail DNS check report as a single HTML file that embeds all required CSS inline, requires no network access to render, and contains the same substantive sections as the in-app report.

#### Scenario: Download produces offline HTML
- **WHEN** the user clicks Download HTML on the report view
- **THEN** the browser saves a `.html` file that opens and displays the full report without external stylesheets or scripts

### Requirement: Backend API Only
All DNS resolution performed by the mail DNS check SHALL use the existing WebSocket JSON query API (`domain`, `record_types`, optional `dns_server`). No new backend endpoints or wire-format fields SHALL be introduced for this feature.

#### Scenario: Queries use existing wire format
- **WHEN** the mail DNS check resolves records
- **THEN** each resolution step is implemented as one or more standard WebSocket query messages to the existing backend
