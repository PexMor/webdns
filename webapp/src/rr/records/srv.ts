import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, tokenize } from "../tokenize";

type SrvFields = ParsedFieldValues & {
  priority: string;
  weight: string;
  port: string;
  target: string;
};

const parseSrv: RrParser<SrvFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 4) return null;
  const [priority, weight, port, target] = tokens;
  if (![priority, weight, port].every(isInteger)) return null;
  return { priority, weight, port, target };
};

const SRV_FIELDS: RrFieldMeta[] = [
  {
    key: "priority",
    label: "Priority",
    explain: {
      minimal: "Priority",
      standard: "Lower numbers are tried first when multiple SRV records exist.",
      detailed:
        "A 16-bit priority (RFC 2782). Clients contact the target with the lowest priority value first, falling back to higher-priority targets on failure.",
    },
  },
  {
    key: "weight",
    label: "Weight",
    explain: {
      minimal: "Load-balancing weight",
      standard: "Relative weight for targets that share the same priority.",
      detailed:
        "Among targets with equal priority, clients should select randomly in proportion to this weight (RFC 2782).",
    },
  },
  {
    key: "port",
    label: "Port",
    explain: {
      minimal: "TCP/UDP port",
      standard: "The port the service listens on at the target host.",
      detailed: "The port number on the target host where the service can be reached.",
    },
  },
  {
    key: "target",
    label: "Target",
    kind: "hostname",
    explain: {
      minimal: "Target hostname",
      standard: "The hostname that provides the service.",
      detailed:
        "The hostname of the machine providing the service. A single '.' means the service is decidedly not available at this domain.",
    },
  },
];

registerRrTypes({
  SRV: { parse: parseSrv, fields: SRV_FIELDS, View: FieldList },
});
