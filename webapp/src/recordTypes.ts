import type { RecordTypeGroup } from "./types";
import type { ConventionId } from "./queryTransforms";

/** DNS record types exposed in the lookup UI (matches hickory-resolver support). */
export const RECORD_TYPE_GROUPS: RecordTypeGroup[] = [
  {
    label: "Address",
    types: ["A", "AAAA"],
  },
  {
    label: "Common",
    types: ["CNAME", "NS", "MX", "TXT", "SOA", "PTR"],
  },
  {
    label: "Service",
    types: ["SRV", "HTTPS", "SVCB", "NAPTR"],
  },
  {
    label: "Security",
    types: ["CAA", "TLSA", "SSHFP", "CERT", "OPENPGPKEY", "SMIMEA"],
  },
  {
    label: "DNSSEC",
    types: [
      "DNSKEY",
      "DS",
      "RRSIG",
      "NSEC",
      "NSEC3",
      "NSEC3PARAM",
      "CDS",
      "CDNSKEY",
      "CSYNC",
    ],
  },
  {
    label: "Other",
    types: ["HINFO", "KEY", "SIG", "ANAME"],
  },
];

export const RECORD_TYPES: string[] = RECORD_TYPE_GROUPS.flatMap((group) => group.types);

/** Maps record types that have a query-name-construction convention (see
 *  `queryTransforms.ts`) to that convention's id. Record types absent from
 *  this table always use the literal domain field as-is. */
export const RECORD_TYPE_CONVENTION: Partial<Record<string, ConventionId>> = {
  PTR: "reverse-dns",
  NAPTR: "enum",
  SRV: "srv",
  TLSA: "tlsa",
  OPENPGPKEY: "openpgpkey",
  SMIMEA: "smimea",
};

export const CONVENTION_RECORD_TYPES: string[] = Object.keys(RECORD_TYPE_CONVENTION);

/** Reverse of `RECORD_TYPE_CONVENTION`, for mapping an engaged convention id
 *  back to the single record type it applies to. */
export function recordTypeForConvention(convention: ConventionId): string | null {
  return (
    Object.keys(RECORD_TYPE_CONVENTION).find((type) => RECORD_TYPE_CONVENTION[type] === convention) ?? null
  );
}

/** Short hover-tooltip text per convention, shown on the record type checkbox
 *  so the transform behavior is discoverable without opening the help modal. */
const CONVENTION_TOOLTIPS: Record<ConventionId, string> = {
  "reverse-dns":
    "PTR: enter an IPv4/IPv6 address to reverse-lookup (e.g. 8.8.4.4 → 4.4.8.8.in-addr.arpa). A plain name queries PTR directly.",
  enum: "NAPTR: enable ENUM mode and enter a phone number to look it up under e164.arpa (e.g. +1-800-555-1234 → 4.3.2.1.5.5.5.0.0.8.1.e164.arpa). Otherwise queries NAPTR directly.",
  srv: "SRV: fill in Service/Protocol to build an owner name (e.g. sip + tcp → _sip._tcp.<domain>). Otherwise queries SRV directly.",
  tlsa: "TLSA: fill in Port/Transport, or paste a URL, to build an owner name (e.g. https://example.com → _443._tcp.example.com). Otherwise queries TLSA directly.",
  openpgpkey:
    "OPENPGPKEY: enter an email address to look up its key by hash (e.g. alice@example.com → <hash>._openpgpkey.example.com).",
  smimea:
    "SMIMEA: enter an email address to look up its cert by hash (e.g. alice@example.com → <hash>._smimecert.example.com).",
};

export function conventionTooltip(type: string): string | null {
  const convention = RECORD_TYPE_CONVENTION[type];
  return convention ? CONVENTION_TOOLTIPS[convention] : null;
}
