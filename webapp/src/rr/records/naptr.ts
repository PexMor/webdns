import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, tokenize } from "../tokenize";

type NaptrFields = ParsedFieldValues & {
  order: string;
  preference: string;
  flags: string;
  service: string;
  regexp: string;
  replacement: string;
};

const parseNaptr: RrParser<NaptrFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 6) return null;
  const [order, preference, flags, service, regexp, replacement] = tokens;
  if (!isInteger(order) || !isInteger(preference)) return null;
  return { order, preference, flags, service, regexp, replacement };
};

const NAPTR_FIELDS: RrFieldMeta[] = [
  {
    key: "order",
    label: "Order",
    explain: {
      minimal: "Processing order",
      standard: "Lower-order rules are applied before higher-order ones.",
      detailed:
        "A 16-bit value (RFC 3403) giving the order in which NAPTR records for a name must be processed, independent of preference.",
    },
  },
  {
    key: "preference",
    label: "Preference",
    explain: {
      minimal: "Tie-break priority",
      standard: "Among rules with the same order, lower preference is tried first.",
      detailed: "A 16-bit value used to sort records that share the same order value.",
    },
  },
  {
    key: "flags",
    label: "Flags",
    explain: {
      minimal: "Rewrite flags",
      standard: "Controls whether this rule is terminal and what the replacement represents.",
      detailed:
        "Single-character flags such as 'S' (replacement is a domain for an SRV lookup), 'A' (A/AAAA lookup), 'U' (replacement is a URI, terminal), or 'P' (protocol-specific).",
    },
  },
  {
    key: "service",
    label: "Service",
    explain: {
      minimal: "Service/protocol",
      standard: "The service and protocol this rule applies to (e.g. E2U+sip).",
      detailed:
        "Identifies the service/protocol combination available at the resulting endpoint, per the application's own registered service parameters.",
    },
  },
  {
    key: "regexp",
    label: "Regexp",
    explain: {
      minimal: "Rewrite rule",
      standard: "A substitution expression applied to the original query to build the result.",
      detailed:
        "A POSIX-style substitution expression (delimiter, match pattern, replacement, delimiter, flags) applied to the original string to produce the next domain name or URI.",
    },
  },
  {
    key: "replacement",
    label: "Replacement",
    explain: {
      minimal: "Next lookup name",
      standard: "The next domain name to query, or '.' if the regexp already produced the result.",
      detailed:
        "A domain name to use for the next lookup step. A single '.' means the regexp field alone determines the outcome.",
    },
  },
];

registerRrTypes({
  NAPTR: { parse: parseNaptr, fields: NAPTR_FIELDS, View: FieldList },
});
