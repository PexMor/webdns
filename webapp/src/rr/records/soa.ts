import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, tokenize } from "../tokenize";

type SoaFields = ParsedFieldValues & {
  mname: string;
  rname: string;
  serial: string;
  refresh: string;
  retry: string;
  expire: string;
  minimum: string;
};

const parseSoa: RrParser<SoaFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 7) return null;
  const [mname, rname, serial, refresh, retry, expire, minimum] = tokens;
  if (![serial, refresh, retry, expire, minimum].every(isInteger)) return null;
  return { mname, rname, serial, refresh, retry, expire, minimum };
};

const SOA_FIELDS: RrFieldMeta[] = [
  {
    key: "mname",
    label: "Primary name server",
    explain: {
      minimal: "Primary name server",
      standard: "The primary (master) name server for this zone.",
      detailed: "The hostname of the primary authoritative name server for this zone (RFC 1035).",
    },
  },
  {
    key: "rname",
    label: "Responsible party",
    explain: {
      minimal: "Zone contact",
      standard: "The zone administrator's contact, encoded as a hostname (first '.' = '@').",
      detailed:
        "The email address of the person responsible for this zone, encoded in domain-name form. The first unescaped dot separates the local part from the domain (e.g. hostmaster.example.com. means hostmaster@example.com).",
    },
  },
  {
    key: "serial",
    label: "Serial",
    explain: {
      minimal: "Zone version",
      standard: "A version number for the zone data, incremented on every change.",
      detailed:
        "A 32-bit serial number. Secondary servers compare this to their own copy to decide whether to transfer a new version of the zone.",
    },
  },
  {
    key: "refresh",
    label: "Refresh (seconds)",
    kind: "duration-seconds",
    explain: {
      minimal: "Refresh interval",
      standard: "How often secondary servers should check for zone updates.",
      detailed: "Seconds a secondary server waits between checks of the primary's serial number.",
    },
  },
  {
    key: "retry",
    label: "Retry (seconds)",
    kind: "duration-seconds",
    explain: {
      minimal: "Retry interval",
      standard: "How long a secondary waits before retrying a failed refresh.",
      detailed: "Seconds a secondary server waits before retrying after a failed refresh attempt.",
    },
  },
  {
    key: "expire",
    label: "Expire (seconds)",
    kind: "duration-seconds",
    explain: {
      minimal: "Expiry",
      standard: "How long a secondary keeps serving stale data if it can't reach the primary.",
      detailed:
        "Seconds after which a secondary server stops answering for the zone if it hasn't been able to refresh from the primary.",
    },
  },
  {
    key: "minimum",
    label: "Minimum TTL (seconds)",
    kind: "duration-seconds",
    explain: {
      minimal: "Negative-cache TTL",
      standard: "The TTL used for caching negative ('no such record') responses.",
      detailed:
        "Per RFC 2308, this field sets the TTL for negative caching (NXDOMAIN / no-data responses), not the minimum TTL of records in the zone.",
    },
  },
];

registerRrTypes({
  SOA: { parse: parseSoa, fields: SOA_FIELDS, View: FieldList },
});
