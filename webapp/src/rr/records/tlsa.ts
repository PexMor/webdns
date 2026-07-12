import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, joinBlob, takePositional, tokenize } from "../tokenize";

type TlsaFields = ParsedFieldValues & {
  usage: string;
  selector: string;
  matchingType: string;
  certData: string;
};

const parseTlsa: RrParser<TlsaFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 3);
  if (!split || split.rest.length === 0) return null;
  const [usage, selector, matchingType] = split.head;
  if (![usage, selector, matchingType].every(isInteger)) return null;
  return { usage, selector, matchingType, certData: joinBlob(split.rest) };
};

const TLSA_FIELDS: RrFieldMeta[] = [
  {
    key: "usage",
    label: "Certificate usage",
    explain: {
      minimal: "Usage",
      standard: "How the certificate association should be used to validate the TLS chain.",
      detailed:
        "0/1 = trust anchor override for the PKIX chain; 2/3 = replace the CA/pin the leaf certificate directly, bypassing the public CA system (RFC 6698).",
    },
  },
  {
    key: "selector",
    label: "Selector",
    explain: {
      minimal: "Selector",
      standard: "Whether the match is against the full certificate (0) or just its public key (1).",
      detailed: "0 = match the full certificate; 1 = match only the SubjectPublicKeyInfo.",
    },
  },
  {
    key: "matchingType",
    label: "Matching type",
    explain: {
      minimal: "Digest type",
      standard: "How the certificate data below is encoded: exact match, SHA-256, or SHA-512.",
      detailed: "0 = exact match of the selected data; 1 = SHA-256 hash; 2 = SHA-512 hash.",
    },
  },
  {
    key: "certData",
    label: "Certificate association data",
    explain: {
      minimal: "Certificate/key/hash data",
      standard: "The certificate, public key, or hash to compare against, as hex.",
      detailed:
        "Hex-encoded data used for DANE validation: depending on selector/matching type, the full certificate, its public key, or a hash of one of those.",
    },
  },
];

registerRrTypes({
  TLSA: { parse: parseTlsa, fields: TLSA_FIELDS, View: FieldList },
});
