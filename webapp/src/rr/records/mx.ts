import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, tokenize } from "../tokenize";

type MxFields = ParsedFieldValues & {
  preference: string;
  exchange: string;
};

const parseMx: RrParser<MxFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 2) return null;
  const [preference, exchange] = tokens;
  if (!isInteger(preference)) return null;
  return { preference, exchange };
};

const MX_FIELDS: RrFieldMeta[] = [
  {
    key: "preference",
    label: "Preference",
    explain: {
      minimal: "Priority",
      standard: "Lower numbers are tried first when multiple MX records exist.",
      detailed:
        "A 16-bit preference value (RFC 5321 §5). Senders attempt delivery to the mail exchanger with the lowest preference value first, falling back to higher values if delivery fails.",
    },
  },
  {
    key: "exchange",
    label: "Mail exchanger",
    explain: {
      minimal: "Mail server hostname",
      standard: "The hostname of a mail server that accepts email for this domain.",
      detailed:
        "The hostname of an SMTP server willing to accept mail for this domain. It must itself resolve to an address record (A/AAAA), not another CNAME.",
    },
  },
];

registerRrTypes({
  MX: { parse: parseMx, fields: MX_FIELDS, View: FieldList },
});
