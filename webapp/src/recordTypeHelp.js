/** Plain-language descriptions for DNS record types shown in the lookup UI. */
export const RECORD_TYPE_HELP = {
  A: {
    title: "A record",
    description:
      "Maps a hostname to an IPv4 address. This is the most common record for websites, APIs, and other internet services.",
    example: "www.example.com.  3600  IN  A  93.184.216.34",
  },
  AAAA: {
    title: "AAAA record",
    description:
      "Maps a hostname to an IPv6 address. It is the IPv6 equivalent of an A record and is increasingly used as networks adopt IPv6.",
    example: "www.example.com.  3600  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946",
  },
  CNAME: {
    title: "CNAME record",
    description:
      "Creates an alias from one hostname to another. Traffic for the alias follows the target name's records. CNAMEs cannot be used on a zone apex (bare domain).",
    example: "www.example.com.  3600  IN  CNAME  example.net.",
  },
  NS: {
    title: "NS record",
    description:
      "Delegates a DNS zone to authoritative name servers. Every domain needs NS records so resolvers know which servers hold the zone data.",
    example: "example.com.  86400  IN  NS  ns1.example.com.",
  },
  MX: {
    title: "MX record",
    description:
      "Specifies mail servers that accept email for the domain. Lower priority numbers are tried first when multiple MX records exist.",
    example: "example.com.  3600  IN  MX  10 mail.example.com.",
  },
  TXT: {
    title: "TXT record",
    description:
      "Stores arbitrary text in DNS. Commonly used for SPF, DKIM, DMARC, domain ownership verification, and other policy or configuration data.",
    example: 'example.com.  3600  IN  TXT  "v=spf1 include:_spf.example.com ~all"',
  },
  SOA: {
    title: "SOA record",
    description:
      "Start of Authority — marks the beginning of a zone and holds metadata such as the primary name server, responsible contact, and zone refresh timers.",
    example:
      "example.com.  3600  IN  SOA  ns1.example.com. hostmaster.example.com. (2025071001 7200 3600 1209600 300)",
  },
  PTR: {
    title: "PTR record",
    description:
      "Maps an IP address back to a hostname (reverse DNS). Often used by mail servers to verify sending hosts and in network troubleshooting.",
    example: "34.216.184.93.in-addr.arpa.  3600  IN  PTR  www.example.com.",
  },
  SRV: {
    title: "SRV record",
    description:
      "Locates a service by hostname and port within a domain. Used for protocols like SIP, XMPP, LDAP, and Microsoft Active Directory services.",
    example: "_xmpp-server._tcp.example.com.  3600  IN  SRV  10 5 5269 xmpp.example.com.",
  },
  HTTPS: {
    title: "HTTPS record",
    description:
      "Advertises HTTPS connection settings for a domain, including preferred endpoints and parameters such as Encrypted Client Hello (ECH). Part of the SVCB family (RFC 9460).",
    example: "example.com.  300  IN  HTTPS  1 . alpn=\"h2,h3\" ipv4hint=93.184.216.34",
  },
  SVCB: {
    title: "SVCB record",
    description:
      "Service binding record that tells clients where and how to reach a service — including target host, port, and protocol-specific hints — without extra lookups.",
    example: "_dns.example.com.  300  IN  SVCB  1 doh.example.com. alpn=\"h2\" port=443",
  },
  NAPTR: {
    title: "NAPTR record",
    description:
      "Naming Authority Pointer — guides clients to the right service or URI for a name. Used in ENUM (E.164 telephone number mapping) and some VoIP routing setups.",
    example:
      '1.2.3.4.5.6.7.8.9.0.example.com.  3600  IN  NAPTR  100 10 "u" "E2U+sip" "!^.*$!sip:alice@example.com!" .',
  },
  CAA: {
    title: "CAA record",
    description:
      "Certificate Authority Authorization — tells certificate authorities which CAs (if any) are allowed to issue TLS certificates for the domain or its subdomains.",
    example: 'example.com.  3600  IN  CAA  0 issue "letsencrypt.org"',
  },
  TLSA: {
    title: "TLSA record",
    description:
      "Associates a TLS certificate or public key with a domain for DANE, allowing clients to validate HTTPS certificates using DNSSEC instead of only public CAs.",
    example: "_443._tcp.example.com.  3600  IN  TLSA  3 1 1 2BBFFDE4C0C76A8D66B3305A1D0DB05B263A70FD",
  },
  SSHFP: {
    title: "SSHFP record",
    description:
      "Publishes SSH host key fingerprints in DNS so SSH clients can verify a server's identity before connecting, when DNSSEC validation is available.",
    example: "www.example.com.  3600  IN  SSHFP  1 1 C4:8D:F2:1A:9B:3E:7F:2C:91:05:D8:44:6A:12:B7:9E:01:F3:88:4D",
  },
  CERT: {
    title: "CERT record",
    description:
      "Stores certificates or certificate-related material (PKIX, SPKI, or PGP) in DNS. Rarely used today but defined for distributing keys or certs via DNS.",
    example: "example.com.  3600  IN  CERT  1 1 3 ( MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A... )",
  },
  OPENPGPKEY: {
    title: "OPENPGPKEY record",
    description:
      "Publishes OpenPGP public keys for an email address or domain, helping mail clients discover keys for encryption and signature verification.",
    example: "alice._openpgpkey.example.com.  3600  IN  OPENPGPKEY  ( mQENBGKx...base64... )",
  },
  SMIMEA: {
    title: "SMIMEA record",
    description:
      "Associates S/MIME certificates with an email address (DANE for S/MIME), enabling clients to validate encrypted-email certificates via DNSSEC.",
    example: "alice._smimecert.example.com.  3600  IN  SMIMEA  3 1 1 A1B2C3D4E5F6789012345678901234567890ABCD",
  },
  DNSKEY: {
    title: "DNSKEY record",
    description:
      "Stores the public signing keys for a DNSSEC-signed zone. Resolvers use DNSKEY records to verify RRSIG signatures and establish trust in zone data.",
    example:
      "example.com.  3600  IN  DNSKEY  256 3 13 ( MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA... )",
  },
  DS: {
    title: "DS record",
    description:
      "Delegation Signer — placed in the parent zone, it contains a hash of a child zone's DNSKEY. It links parent and child in the DNSSEC chain of trust.",
    example: "sub.example.com.  3600  IN  DS  2371 13 2 C988EC423E3880EB8DD8A46FE06CA230EE23F35B",
  },
  RRSIG: {
    title: "RRSIG record",
    description:
      "DNSSEC signature over a set of records. Proves that the signed data was issued by the zone owner and has not been tampered with.",
    example:
      "example.com.  3600  IN  RRSIG  A 13 2 3600 20250710000000 20250626000000 12345 example.com. ( oR8G3...signature... )",
  },
  NSEC: {
    title: "NSEC record",
    description:
      "Authenticated denial of existence in DNSSEC. Proves that a name or record type does not exist by linking to the next name in canonical order.",
    example: "a.example.com.  3600  IN  NSEC  b.example.com. A RRSIG NSEC",
  },
  NSEC3: {
    title: "NSEC3 record",
    description:
      "Like NSEC, but owner names are hashed to reduce zone walking (enumeration of all names in a zone) while still proving that a name does not exist.",
    example:
      "8P6K4VNSQ2VTO8CCS8488C1A5IT4K63V.example.com.  3600  IN  NSEC3  1 0 0 - ( 9T0...HASH... ) A RRSIG",
  },
  NSEC3PARAM: {
    title: "NSEC3PARAM record",
    description:
      "Holds the hash algorithm, salt, and iteration count used by NSEC3 records in a zone. Published at the zone apex; not used in resolution directly.",
    example: "example.com.  3600  IN  NSEC3PARAM  1 0 0 -",
  },
  CDS: {
    title: "CDS record",
    description:
      "Child DS — published in a child zone to tell the parent which DS record(s) should be installed during a DNSSEC key rollover or initial trust setup.",
    example: "example.com.  3600  IN  CDS  2371 13 2 C988EC423E3880EB8DD8A46FE06CA230EE23F35B",
  },
  CDNSKEY: {
    title: "CDNSKEY record",
    description:
      "Child DNSKEY — an alternative to CDS for signaling which DNSKEY the parent should reference, simplifying some automated DNSSEC rollovers.",
    example: "example.com.  3600  IN  CDNSKEY  257 3 13 ( MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA... )",
  },
  CSYNC: {
    title: "CSYNC record",
    description:
      "Child-to-parent synchronization hint. Indicates which record types (such as NS or A) should be copied from child to parent during zone maintenance.",
    example: "example.com.  3600  IN  CSYNC  2025071001 3 6 ( A NS SOA )",
  },
  HINFO: {
    title: "HINFO record",
    description:
      "Optional host information (CPU and operating system strings). Defined in early DNS but rarely published today and often blocked by resolvers.",
    example: 'www.example.com.  3600  IN  HINFO  "x86-64" "Linux"',
  },
  KEY: {
    title: "KEY record",
    description:
      "Legacy general-purpose key record from early DNS security work. Largely obsolete for DNSSEC, which uses DNSKEY instead.",
    example: "example.com.  3600  IN  KEY  256 3 5 ( AQPIAAAA... )",
  },
  SIG: {
    title: "SIG record",
    description:
      "Legacy signature record from pre-DNSSEC designs. Superseded by RRSIG in modern DNSSEC.",
    example: "example.com.  3600  IN  SIG  A 5 2 3600 20250710000000 20250626000000 12345 example.com. ( ... )",
  },
  ANAME: {
    title: "ANAME record",
    description:
      "Non-standard alias record offered by some DNS providers. Behaves like a CNAME at the zone apex, where standard CNAME records are not allowed.",
    example: "example.com.  300  IN  ANAME  cdn.example.net.",
  },
};

export function getRecordTypeHelp(type) {
  return (
    RECORD_TYPE_HELP[type] ?? {
      title: `${type} record`,
      description: "No description is available for this record type yet.",
      example: null,
    }
  );
}
