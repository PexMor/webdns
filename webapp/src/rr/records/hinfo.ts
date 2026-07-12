import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { tokenize } from "../tokenize";

type HinfoFields = ParsedFieldValues & {
  cpu: string;
  os: string;
};

const parseHinfo: RrParser<HinfoFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 2) return null;
  const [cpu, os] = tokens;
  return { cpu, os };
};

const HINFO_FIELDS: RrFieldMeta[] = [
  {
    key: "cpu",
    label: "CPU type",
    explain: {
      minimal: "Hardware",
      standard: "A free-text description of the host's CPU/hardware.",
      detailed: "An implementation-defined string identifying the machine's CPU type (RFC 1035).",
    },
  },
  {
    key: "os",
    label: "Operating system",
    explain: {
      minimal: "OS",
      standard: "A free-text description of the host's operating system.",
      detailed:
        "An implementation-defined string identifying the machine's OS. Rarely published today, and often blocked by resolvers as an information-disclosure risk.",
    },
  },
];

registerRrTypes({
  HINFO: { parse: parseHinfo, fields: HINFO_FIELDS, View: FieldList },
});
