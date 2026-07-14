## Purpose

Helpers that convert raw user input into the correctly-shaped DNS query name for record types with well-known query-name conventions (PTR reverse DNS, ENUM/NAPTR, SRV, TLSA, OPENPGPKEY, SMIMEA), plus a shared helper to determine when such a convention is "engaged" for the current form state.

## Requirements

### Requirement: Reverse DNS (PTR) Query Transform
The system SHALL provide a helper that converts a user-entered IPv4 or IPv6
address into the corresponding PTR query name
(`<reversed-octets>.in-addr.arpa` for IPv4, `<reversed-nibbles>.ip6.arpa` for
IPv6), and SHALL pass through input that is already a fully-qualified
`in-addr.arpa`/`ip6.arpa` name unchanged. Input that is neither a valid
IPv4/IPv6 address nor an already-qualified reverse name SHALL be treated as a
literal owner name (not an error) so that plain `PTR` queries against an
ordinary domain continue to work.

#### Scenario: IPv4 address converted to PTR query name
- **WHEN** the transform is called for record type `PTR` with input `8.8.4.4`
- **THEN** it returns query name `4.4.8.8.in-addr.arpa`

#### Scenario: IPv6 address converted to PTR query name
- **WHEN** the transform is called for record type `PTR` with input `2001:db8::567:89ab`
- **THEN** it returns the corresponding nibble-reversed `ip6.arpa` query name

#### Scenario: Already-qualified reverse name passes through
- **WHEN** the transform is called for record type `PTR` with input `4.4.8.8.in-addr.arpa`
- **THEN** it returns the input unchanged as the query name

#### Scenario: Ordinary hostname is queried literally, not rejected
- **WHEN** the transform is called for record type `PTR` with input that is not a valid IPv4/IPv6 address and not an already-qualified reverse name (e.g. `example.com`)
- **THEN** it returns the input unchanged as the query name, with no validation error

### Requirement: ENUM (NAPTR) Query Transform
The system SHALL provide a helper that, only when ENUM mode is explicitly
requested by the caller, converts a user-entered phone number into the
corresponding query name under `e164.arpa` (digits reversed and
dot-separated, e.g. `+1-800-555-1234` → `4.3.2.1.5.5.5.0.0.8.1.e164.arpa`).
When ENUM mode is not requested, a `NAPTR` query SHALL pass the input through
unchanged so existing generic-hostname `NAPTR` lookups are unaffected.

#### Scenario: Phone number converted to ENUM query name
- **WHEN** the transform is called for record type `NAPTR` with ENUM mode enabled and input `1-800-555-1234`
- **THEN** it returns query name `4.3.2.1.5.5.5.0.0.8.1.e164.arpa`

#### Scenario: Plain NAPTR lookup unaffected when ENUM mode is off
- **WHEN** the transform is called for record type `NAPTR` with ENUM mode disabled and input `example.com`
- **THEN** it returns the input unchanged as the query name

#### Scenario: Phone number with no digits rejected
- **WHEN** the transform is called for record type `NAPTR` with ENUM mode enabled and input containing no digits
- **THEN** it returns a validation error and no query name

### Requirement: SRV Query Transform
The system SHALL provide a helper that, when a Service and/or Protocol value
is supplied alongside a domain, constructs the SRV query name
`_service._protocol.domain` (accepting the service/protocol with or without
a leading underscore). When no Service or Protocol value is supplied, an
`SRV` query SHALL use the literal domain field unchanged, including when the
user has typed an already-underscored owner name directly.

#### Scenario: Service and protocol construct the SRV query name
- **WHEN** the transform is called for record type `SRV` with service `sip`, protocol `tcp`, and domain `example.com`
- **THEN** it returns query name `_sip._tcp.example.com`

#### Scenario: No service/protocol supplied queries the literal domain
- **WHEN** the transform is called for record type `SRV` with no service or protocol supplied and domain `_sip._tcp.example.com`
- **THEN** it returns the domain unchanged as the query name

### Requirement: TLSA Query Transform
The system SHALL provide a helper that, when a Port and/or Transport value is
supplied alongside a domain, constructs the TLSA query name
`_port._transport.domain`, and SHALL also derive port and host from a pasted
URL (e.g. `https://example.com` → port `443`, host `example.com`). When no
port/transport is supplied and the domain is not a parseable URL, a `TLSA`
query SHALL use the literal domain field unchanged.

#### Scenario: Port and transport construct the TLSA query name
- **WHEN** the transform is called for record type `TLSA` with port `443`, transport `tcp`, and domain `example.com`
- **THEN** it returns query name `_443._tcp.example.com`

#### Scenario: URL input derives port and host
- **WHEN** the transform is called for record type `TLSA` with domain field value `https://www.example.com` and no explicit port/transport
- **THEN** it returns query name `_443._tcp.www.example.com`

#### Scenario: No port/transport and not a URL queries the literal domain
- **WHEN** the transform is called for record type `TLSA` with no port or transport supplied and domain `_25._tcp.mail.example.com`
- **THEN** it returns the domain unchanged as the query name

#### Scenario: Invalid port rejected
- **WHEN** the transform is called for record type `TLSA` with a port value outside 1-65535
- **THEN** it returns a validation error and no query name

### Requirement: OPENPGPKEY Query Transform
The system SHALL provide a helper that, when the input contains an `@`
(interpreted as an email address), computes the SHA-256 hash of the
canonicalized local-part per RFC 7929 §3, truncates it to 28 octets,
hex-encodes it, and constructs the query name
`<hash>._openpgpkey.<domain-part-of-email>`. Input without `@` SHALL be
treated as a literal owner name.

#### Scenario: Email address converted to OPENPGPKEY query name
- **WHEN** the transform is called for record type `OPENPGPKEY` with input `alice@example.com`
- **THEN** it returns a query name of the form `<56-hex-character-hash>._openpgpkey.example.com`

#### Scenario: Non-email input queried literally
- **WHEN** the transform is called for record type `OPENPGPKEY` with input `example.com`
- **THEN** it returns the input unchanged as the query name

#### Scenario: Hashing unavailable surfaces a clear error
- **WHEN** the transform is called for record type `OPENPGPKEY` with an email address in a context where `crypto.subtle` is unavailable (non-secure context)
- **THEN** it returns a validation error explaining that email-based lookups require a secure (HTTPS) context

### Requirement: SMIMEA Query Transform
The system SHALL provide a helper that, when the input contains an `@`
(interpreted as an email address), computes the SHA-256 hash of the
canonicalized local-part per RFC 8162 §3, truncates it to 28 octets,
hex-encodes it, and constructs the query name
`<hash>._smimecert.<domain-part-of-email>`. Input without `@` SHALL be
treated as a literal owner name.

#### Scenario: Email address converted to SMIMEA query name
- **WHEN** the transform is called for record type `SMIMEA` with input `alice@example.com`
- **THEN** it returns a query name of the form `<56-hex-character-hash>._smimecert.example.com`

#### Scenario: Non-email input queried literally
- **WHEN** the transform is called for record type `SMIMEA` with input `example.com`
- **THEN** it returns the input unchanged as the query name

### Requirement: Convention Engagement Classification
The system SHALL expose a helper that determines, for the currently selected
record types and current input state (domain field, ENUM toggle, SRV/TLSA
extra fields), whether a query-name-construction convention is "engaged" —
i.e. would produce a query name that diverges from the literal domain field.
Engagement rules SHALL be: PTR engages when the domain is a valid IPv4/IPv6
address; NAPTR engages only when ENUM mode is explicitly enabled; SRV/TLSA
engage when their respective extra fields are non-empty (or, for TLSA, when
the domain is a parseable URL); OPENPGPKEY/SMIMEA engage when the domain
contains `@`. When no rule matches, no convention is engaged.

#### Scenario: No convention engaged by default
- **WHEN** the selected record types are `A` and `MX` with a plain hostname in the domain field
- **THEN** the engagement helper reports no convention is engaged

#### Scenario: PTR engages automatically on IP-shaped input
- **WHEN** `PTR` is selected and the domain field contains a valid IP address
- **THEN** the engagement helper reports the reverse-DNS convention is engaged

#### Scenario: PTR does not engage on hostname input
- **WHEN** `PTR` is selected and the domain field contains an ordinary hostname
- **THEN** the engagement helper reports no convention is engaged

#### Scenario: NAPTR engages only with ENUM mode on
- **WHEN** `NAPTR` is selected and the ENUM toggle is enabled
- **THEN** the engagement helper reports the ENUM convention is engaged

#### Scenario: Email-shaped input engages OPENPGPKEY/SMIMEA
- **WHEN** `OPENPGPKEY` or `SMIMEA` is selected and the domain field contains `@`
- **THEN** the engagement helper reports the corresponding convention is engaged
