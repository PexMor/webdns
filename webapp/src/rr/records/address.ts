import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { tokenize } from "../tokenize";

type AddressFields = ParsedFieldValues & {
  address: string;
};

function makeParser(kind: "IPv4" | "IPv6"): RrParser<AddressFields> {
  return (raw) => {
    const tokens = tokenize(raw);
    if (tokens.length !== 1) return null;
    const address = tokens[0];
    if (kind === "IPv4" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return null;
    if (kind === "IPv6" && !address.includes(":")) return null;
    return { address };
  };
}

const A_FIELDS: RrFieldMeta[] = [
  {
    key: "address",
    label: "IPv4 address",
    explain: {
      minimal: "IPv4 address",
      standard: "The IPv4 address this hostname resolves to.",
      detailed:
        "A 32-bit IPv4 address (RFC 1035). Clients connect to this address when reaching the hostname over IPv4.",
    },
  },
];

const AAAA_FIELDS: RrFieldMeta[] = [
  {
    key: "address",
    label: "IPv6 address",
    explain: {
      minimal: "IPv6 address",
      standard: "The IPv6 address this hostname resolves to.",
      detailed:
        "A 128-bit IPv6 address (RFC 3596). Clients connect to this address when reaching the hostname over IPv6.",
    },
  },
];

registerRrTypes({
  A: { parse: makeParser("IPv4"), fields: A_FIELDS, View: FieldList },
  AAAA: { parse: makeParser("IPv6"), fields: AAAA_FIELDS, View: FieldList },
});
