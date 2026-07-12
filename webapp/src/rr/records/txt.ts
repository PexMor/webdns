import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { tokenize } from "../tokenize";

type TxtFields = ParsedFieldValues & {
  strings: string[];
};

const parseTxt: RrParser<TxtFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return null;
  return { strings: tokens };
};

const TXT_FIELDS: RrFieldMeta[] = [
  {
    key: "strings",
    label: "Text",
    explain: {
      minimal: "Text value",
      standard: "Free-form text published for this domain.",
      detailed:
        "One or more character-strings (RFC 1035) up to 255 bytes each. Commonly used for SPF, DKIM, DMARC, domain-ownership verification, and other policy or configuration data. Multiple strings on one record are typically concatenated by the consuming application.",
    },
  },
];

registerRrTypes({
  TXT: { parse: parseTxt, fields: TXT_FIELDS, View: FieldList },
});
