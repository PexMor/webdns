import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, tokenize } from "../tokenize";

type CaaFields = ParsedFieldValues & {
  flag: string;
  tag: string;
  value: string;
};

const parseCaa: RrParser<CaaFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 3) return null;
  const [flag, tag, value] = tokens;
  if (!isInteger(flag)) return null;
  return { flag, tag, value };
};

const CAA_FIELDS: RrFieldMeta[] = [
  {
    key: "flag",
    label: "Flag",
    explain: {
      minimal: "Critical flag",
      standard: "A non-zero value means CAs that don't understand this tag must refuse to issue.",
      detailed:
        "An 8-bit issuer critical flag (RFC 8659). If set (non-zero), a CA that does not implement this property tag must not issue a certificate for the name.",
    },
  },
  {
    key: "tag",
    label: "Tag",
    explain: {
      minimal: "Property",
      standard: "Which CAA property this record sets: issue, issuewild, or iodef.",
      detailed:
        "'issue' authorizes a CA to issue certificates for this exact name; 'issuewild' authorizes wildcard issuance; 'iodef' names a URL/mailbox for CAs to report policy violations to.",
    },
  },
  {
    key: "value",
    label: "Value",
    explain: {
      minimal: "Property value",
      standard: "The CA domain (for issue/issuewild) or reporting address (for iodef).",
      detailed:
        "For 'issue'/'issuewild', the domain name of an authorized certificate authority (or ';' to authorize none). For 'iodef', a mailto: or http(s):// URL to send violation reports to.",
    },
  },
];

registerRrTypes({
  CAA: { parse: parseCaa, fields: CAA_FIELDS, View: FieldList },
});
