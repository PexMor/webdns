import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, joinBlob, takePositional, tokenize } from "../tokenize";

type SigFields = ParsedFieldValues & {
  typeCovered: string;
  algorithm: string;
  labels: string;
  originalTtl: string;
  expiration: string;
  inception: string;
  keyTag: string;
  signerName: string;
  signature: string;
};

const parseSig: RrParser<SigFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 8);
  if (!split || split.rest.length === 0) return null;
  const [typeCovered, algorithm, labels, originalTtl, expiration, inception, keyTag, signerName] =
    split.head;
  if (![algorithm, labels, originalTtl, expiration, inception, keyTag].every(isInteger)) {
    return null;
  }
  return {
    typeCovered,
    algorithm,
    labels,
    originalTtl,
    expiration,
    inception,
    keyTag,
    signerName,
    signature: joinBlob(split.rest),
  };
};

function sigFields(kind: "RRSIG" | "SIG"): RrFieldMeta[] {
  const legacyNote = kind === "SIG" ? " SIG is the pre-DNSSEC predecessor of RRSIG." : "";
  return [
    {
      key: "typeCovered",
      label: "Type covered",
      explain: {
        minimal: "Record type signed",
        standard: "Which record type this signature covers (e.g. A, MX, DNSKEY).",
        detailed: `The record type whose RRset at this name is being signed.${legacyNote}`,
      },
    },
    {
      key: "algorithm",
      label: "Algorithm",
      explain: {
        minimal: "Signing algorithm",
        standard: "The DNSSEC algorithm number used to produce this signature.",
        detailed: "Must match the algorithm of the DNSKEY identified by the key tag below.",
      },
    },
    {
      key: "labels",
      label: "Labels",
      explain: {
        minimal: "Owner name labels",
        standard: "The number of labels in the original owner name, used to detect wildcard expansion.",
        detailed:
          "Lets a validator recognize when a wildcard record was expanded to answer the query, since the labels count won't match the queried name's label count in that case.",
      },
    },
    {
      key: "originalTtl",
      label: "Original TTL (seconds)",
      kind: "duration-seconds",
      explain: {
        minimal: "Signed TTL",
        standard: "The TTL of the signed RRset as published, independent of any local TTL decay.",
        detailed: "Validators reconstruct the signed data using this TTL rather than the possibly-decremented TTL seen in the response.",
      },
    },
    {
      key: "expiration",
      label: "Signature expiration",
      explain: {
        minimal: "Valid until",
        standard: "Timestamp (YYYYMMDDHHMMSS, UTC) after which this signature is no longer valid.",
        detailed: "An absolute UTC timestamp; resolvers must reject the signature once their clock passes this value.",
      },
    },
    {
      key: "inception",
      label: "Signature inception",
      explain: {
        minimal: "Valid from",
        standard: "Timestamp (YYYYMMDDHHMMSS, UTC) before which this signature is not yet valid.",
        detailed: "An absolute UTC timestamp; resolvers must reject the signature before their clock reaches this value.",
      },
    },
    {
      key: "keyTag",
      label: "Key tag",
      explain: {
        minimal: "Signing key tag",
        standard: "Identifies which of the zone's DNSKEY records produced this signature.",
        detailed: "A 16-bit tag matching the key tag of the DNSKEY that should be used to verify this signature.",
      },
    },
    {
      key: "signerName",
      label: "Signer's name",
      explain: {
        minimal: "Signing zone",
        standard: "The zone whose key signed this record (usually the zone itself).",
        detailed: "The owner name of the zone apex whose DNSKEY RRset should be used to validate this signature.",
      },
    },
    {
      key: "signature",
      label: "Signature",
      explain: {
        minimal: "Signature data",
        standard: "The cryptographic signature itself, base64-encoded.",
        detailed: "Base64-encoded signature over the RRset, computed per the algorithm above; not verified or decoded further here.",
      },
    },
  ];
}

registerRrTypes({
  RRSIG: { parse: parseSig, fields: sigFields("RRSIG"), View: FieldList },
  SIG: { parse: parseSig, fields: sigFields("SIG"), View: FieldList },
});
