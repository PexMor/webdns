## Purpose

Interactive follow-up DNS lookups from parsed record field values (addresses, hostnames, SPF mechanisms, SVCB hints, SOA abuse contact).

## Requirements

### Requirement: IP Address Follow-Up Query
The web client SHALL let the user click a parsed field value that is an IPv4 or IPv6 address (A/AAAA `address`) to immediately run and execute a new `PTR` lookup for that exact address, using the same programmatic lookup path already used for quick lookups and history re-runs, without requiring the user to retype or navigate to the form.

#### Scenario: Clicking an A record's address runs a PTR lookup
- **WHEN** the user clicks the parsed `address` value of a successful `A` record result (e.g. `93.184.216.34`)
- **THEN** the client populates the lookup form with domain `93.184.216.34` and record type `PTR` and submits the query immediately

#### Scenario: Clicking an AAAA record's address runs a PTR lookup
- **WHEN** the user clicks the parsed `address` value of a successful `AAAA` record result
- **THEN** the client populates the lookup form with that IPv6 address and record type `PTR` and submits the query immediately

### Requirement: Hostname Follow-Up Query
The web client SHALL let the user click a parsed field value that names a hostname used for further DNS resolution (MX `exchange`; NS/CNAME/ANAME/PTR `target`; SOA `mname`; SRV/SVCB/HTTPS `target`; NAPTR `replacement`) to immediately run and execute a new lookup for `A` and `AAAA` records at that hostname, using the same programmatic lookup path already used for quick lookups and history re-runs.

#### Scenario: Clicking an MX exchange hostname runs an A/AAAA lookup
- **WHEN** the user clicks the parsed `exchange` value of a successful `MX` record result (e.g. `mail.example.com`)
- **THEN** the client populates the lookup form with domain `mail.example.com` and record types `A` and `AAAA` and submits the query immediately

#### Scenario: Clicking an NS/CNAME/PTR target hostname runs an A/AAAA lookup
- **WHEN** the user clicks the parsed target hostname of a successful `NS`, `CNAME`, `ANAME`, or `PTR` record result
- **THEN** the client populates the lookup form with that hostname and record types `A` and `AAAA` and submits the query immediately

### Requirement: Placeholder Values Are Not Actionable
The web client SHALL NOT render a follow-up action for a hostname-kind field whose value is the DNS root/placeholder name (`.`) or empty, since such a value does not name a resolvable host.

#### Scenario: SRV/NAPTR "not available" placeholder is not clickable
- **WHEN** a parsed `SRV` target or `NAPTR` replacement field has the literal value `.`
- **THEN** the client renders that value as plain, non-interactive text instead of a clickable follow-up action

### Requirement: SOA Abuse Contact Email Link
The web client SHALL decode a parsed SOA record's `rname` field (RFC 1035 domain-name-encoded responsible-party address, where the first unescaped `.` separates the local part from the domain) into a standard `user@domain` email address and render it as a `mailto:` link alongside the field's existing raw value, so the zone's administrative contact can be copied or opened in a mail client directly for abuse reporting.

#### Scenario: Well-formed rname renders a mailto link
- **WHEN** a parsed `SOA` record's `rname` field has value `hostmaster.example.com`
- **THEN** the client renders a `mailto:hostmaster@example.com` link alongside the existing raw field value

#### Scenario: rname with an escaped dot in the local part decodes correctly
- **WHEN** a parsed `SOA` record's `rname` field has value `john\.doe.example.com` (escaped dot within the local part)
- **THEN** the client renders a `mailto:john.doe@example.com` link, treating the first *unescaped* dot as the local-part/domain separator

#### Scenario: rname that cannot be decoded into an email falls back gracefully
- **WHEN** a parsed `SOA` record's `rname` field value has no further labels after the local part (e.g. a bare single label) and cannot form a valid `local@domain` address
- **THEN** the client renders only the existing raw field value, without a broken or empty `mailto:` link

### Requirement: SPF Mechanism Follow-Up Query
The web client SHALL parse a TXT record's text as an SPF (RFC 7208) policy when it begins with the `v=spf1` version term, and SHALL let the user click the domain or address named by each `a`, `mx`, `include`, `exists`, `redirect`, `ip4`, or `ip6` mechanism independently: `a`/`mx`/`include`/`exists`/`redirect` targets run a new `A`+`AAAA` lookup for the named domain, and `ip4`/`ip6` targets run a new `PTR` lookup for the named address, via the same programmatic lookup path already used elsewhere. Any leading qualifier (`+`/`-`/`~`/`?`) and CIDR suffix (e.g. `/24`) on a mechanism render as plain text around the clickable value, unmodified.

#### Scenario: Clicking an a: or mx: mechanism's hostname runs an A/AAAA lookup
- **WHEN** the user clicks the domain named by an `a:` or `mx:` mechanism in a parsed SPF TXT record (e.g. `a:mail.example.com`)
- **THEN** the client populates the lookup form with that domain and record types `A` and `AAAA` and submits the query immediately

#### Scenario: Clicking an include:, exists:, or redirect= mechanism's domain runs an A/AAAA lookup
- **WHEN** the user clicks the domain named by an `include:`, `exists:`, or `redirect=` mechanism (e.g. `include:_spf.google.com`)
- **THEN** the client populates the lookup form with that domain and record types `A` and `AAAA` and submits the query immediately

#### Scenario: Clicking an ip4: or ip6: mechanism's address runs a PTR lookup
- **WHEN** the user clicks the address named by an `ip4:` or `ip6:` mechanism (e.g. `ip4:46.36.35.234`)
- **THEN** the client populates the lookup form with that address and record type `PTR` and submits the query immediately

#### Scenario: A CIDR suffix is excluded from the clickable value
- **WHEN** a mechanism includes a CIDR suffix (e.g. `ip4:46.36.35.0/24` or `a:mail.example.com/24`)
- **THEN** clicking the value runs the follow-up lookup using only the domain/address (`46.36.35.0` or `mail.example.com`), with the `/24` suffix rendered as plain, non-interactive text

### Requirement: SPF Non-Actionable Terms
The web client SHALL NOT render a follow-up action for an SPF term that has no literal, resolvable target: a bare mechanism keyword with no explicit domain (e.g. `mx`, `a` alone), an `all` qualifier term (`all`, `-all`, `~all`, `+all`, `?all`), the `v=spf1` version term itself, an unrecognized mechanism, or a mechanism whose domain-spec contains a macro letter (e.g. `exists:%{i}.example.com`).

#### Scenario: Bare mx/a mechanisms are not clickable
- **WHEN** a parsed SPF record includes a bare `mx` or `a` mechanism with no domain suffix
- **THEN** the client renders that term as plain, non-interactive text

#### Scenario: The all mechanism and its qualifiers are not clickable
- **WHEN** a parsed SPF record ends with an `all` mechanism, with or without a qualifier (e.g. `-all`)
- **THEN** the client renders that term as plain, non-interactive text

#### Scenario: A macro-letter domain-spec is not clickable
- **WHEN** an SPF mechanism's domain-spec contains a macro letter (e.g. `exists:%{i}.example.com`)
- **THEN** the client renders that term as plain, non-interactive text, since the literal text is not a resolvable hostname

### Requirement: SVCB/HTTPS Address Hint Follow-Up Query
The web client SHALL let the user click any individual address within an SVCB or HTTPS record's `ipv4hint` or `ipv6hint` service parameter (RFC 9460 §7.3, which may list multiple comma-separated addresses) to immediately run and execute a new `PTR` lookup for that exact address, independent of the other addresses in the same hint and independent of the record's own `target` follow-up action. Other service parameters (e.g. `alpn`, `port`, `ech`) SHALL continue to render as plain text.

#### Scenario: Clicking a single-address hint runs a PTR lookup
- **WHEN** the user clicks the address in a parsed `ipv4hint=93.184.216.34` or `ipv6hint=2001:db8::1` service parameter
- **THEN** the client populates the lookup form with that address and record type `PTR` and submits the query immediately

#### Scenario: Each address in a multi-address hint is independently clickable
- **WHEN** a parsed service parameter has multiple comma-separated addresses (e.g. `ipv4hint=93.184.216.34,93.184.216.35`)
- **THEN** the client renders each address as its own independent clickable follow-up trigger

#### Scenario: Non-address service parameters are not clickable
- **WHEN** a parsed SVCB/HTTPS record includes a non-address service parameter (e.g. `alpn=h2,h3`)
- **THEN** the client renders that parameter as plain, non-interactive text

### Requirement: Follow-Up Actions Are Scoped to Query Results
The web client SHALL only offer follow-up actions on parsed fields shown in the live query results and lookup history views, and SHALL NOT offer them on the record type help modal's representative example, since the help example does not correspond to a real query the user ran.

#### Scenario: Help modal example values are not clickable
- **WHEN** the user opens the record type help modal for a type whose example includes an address or hostname field
- **THEN** the client renders that field's value as plain text, with no follow-up action available
