import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { tokenize } from "../tokenize";

type TargetFields = ParsedFieldValues & {
  target: string;
};

const parseTarget: RrParser<TargetFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 1) return null;
  return { target: tokens[0] };
};

function targetFields(label: string, standard: string, detailed: string): RrFieldMeta[] {
  return [
    {
      key: "target",
      label,
      explain: { minimal: label, standard, detailed },
    },
  ];
}

registerRrTypes({
  CNAME: {
    parse: parseTarget,
    fields: targetFields(
      "Alias target",
      "The canonical hostname this alias points to.",
      "CNAME (RFC 1035) makes this name an alias: resolvers restart resolution using the target hostname's own records. CNAMEs cannot coexist with other record types on the same name, and cannot be used at a zone apex."
    ),
    View: FieldList,
  },
  NS: {
    parse: parseTarget,
    fields: targetFields(
      "Name server",
      "An authoritative name server for this zone.",
      "NS (RFC 1035) delegates a zone to an authoritative name server. Every domain needs at least one NS record so resolvers know where to fetch its records."
    ),
    View: FieldList,
  },
  PTR: {
    parse: parseTarget,
    fields: targetFields(
      "Hostname",
      "The hostname this address maps back to.",
      "PTR (RFC 1035) provides reverse DNS: given an IP address's in-addr.arpa/ip6.arpa name, it returns the associated hostname. Commonly used by mail servers and network diagnostics."
    ),
    View: FieldList,
  },
  ANAME: {
    parse: parseTarget,
    fields: targetFields(
      "Alias target",
      "The hostname this zone-apex alias resolves through.",
      "ANAME is a non-standard, provider-specific record that behaves like a CNAME but is allowed at a zone apex, where standard CNAME records are disallowed."
    ),
    View: FieldList,
  },
});
