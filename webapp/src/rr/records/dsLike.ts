import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, joinBlob, takePositional, tokenize } from "../tokenize";

type DsFields = ParsedFieldValues & {
  keyTag: string;
  algorithm: string;
  digestType: string;
  digest: string;
};

const parseDs: RrParser<DsFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 3);
  if (!split || split.rest.length === 0) return null;
  const [keyTag, algorithm, digestType] = split.head;
  if (![keyTag, algorithm, digestType].every(isInteger)) return null;
  return { keyTag, algorithm, digestType, digest: joinBlob(split.rest) };
};

function dsFields(kind: "DS" | "CDS"): RrFieldMeta[] {
  const purpose =
    kind === "DS"
      ? "Placed in the parent zone to link to a child zone's DNSKEY, forming the DNSSEC chain of trust."
      : "Published in the child zone to tell the parent which DS record(s) to install during a key rollover.";
  return [
    {
      key: "keyTag",
      label: "Key tag",
      explain: {
        minimal: "Key tag",
        standard: "A short numeric identifier for the referenced DNSKEY.",
        detailed: "A 16-bit checksum-like tag identifying which of the zone's DNSKEY records this digest covers.",
      },
    },
    {
      key: "algorithm",
      label: "Algorithm",
      explain: {
        minimal: "Key algorithm",
        standard: "The DNSSEC algorithm number of the referenced DNSKEY.",
        detailed: "Must match the algorithm field of the referenced DNSKEY record.",
      },
    },
    {
      key: "digestType",
      label: "Digest type",
      explain: {
        minimal: "Digest algorithm",
        standard: "Which hash algorithm was used to compute the digest below (e.g. 2 = SHA-256).",
        detailed: "IANA digest algorithm number: 1 = SHA-1, 2 = SHA-256, 4 = SHA-384, etc.",
      },
    },
    {
      key: "digest",
      label: "Digest",
      explain: {
        minimal: "Key digest",
        standard: purpose,
        detailed: `Hex-encoded hash of the referenced DNSKEY's owner name and RDATA. ${purpose}`,
      },
    },
  ];
}

registerRrTypes({
  DS: { parse: parseDs, fields: dsFields("DS"), View: FieldList },
  CDS: { parse: parseDs, fields: dsFields("CDS"), View: FieldList },
});
