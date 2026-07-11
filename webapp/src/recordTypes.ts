import type { RecordTypeGroup } from "./types";

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
