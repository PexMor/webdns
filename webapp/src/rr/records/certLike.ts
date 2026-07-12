import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, joinBlob, takePositional, tokenize } from "../tokenize";

type CertFields = ParsedFieldValues & {
  certType: string;
  keyTag: string;
  algorithm: string;
  certificate: string;
};

const parseCert: RrParser<CertFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 3);
  if (!split || split.rest.length === 0) return null;
  const [certType, keyTag, algorithm] = split.head;
  if (!isInteger(certType) || !isInteger(keyTag) || !isInteger(algorithm)) return null;
  return { certType, keyTag, algorithm, certificate: joinBlob(split.rest) };
};

const CERT_FIELDS: RrFieldMeta[] = [
  {
    key: "certType",
    label: "Certificate type",
    explain: {
      minimal: "Cert type",
      standard: "The certificate format: PKIX, SPKI, PGP, or a related variant (RFC 4398).",
      detailed:
        "IANA certificate type code: e.g. 1 = X.509 (PKIX), 2 = SPKI, 3 = OpenPGP, plus URL/fingerprint variants.",
    },
  },
  {
    key: "keyTag",
    label: "Key tag",
    explain: {
      minimal: "Key tag",
      standard: "A short numeric identifier for the associated key, matching DNSSEC key tags.",
      detailed: "For certificate types tied to a DNSSEC key, this mirrors that key's key tag; otherwise zero.",
    },
  },
  {
    key: "algorithm",
    label: "Algorithm",
    explain: {
      minimal: "Algorithm",
      standard: "The public-key algorithm used by the certificate/key, using DNSSEC algorithm numbers.",
      detailed: "Zero if the certificate type doesn't require specifying an algorithm.",
    },
  },
  {
    key: "certificate",
    label: "Certificate data",
    explain: {
      minimal: "Certificate/key material",
      standard: "The certificate or key itself, base64-encoded.",
      detailed: "The raw certificate, CRL, PKCS, or key material, base64-encoded per RFC 4398.",
    },
  },
];

type BlobFields = ParsedFieldValues & {
  data: string;
};

const parseBlob: RrParser<BlobFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return null;
  return { data: joinBlob(tokens) };
};

const OPENPGPKEY_FIELDS: RrFieldMeta[] = [
  {
    key: "data",
    label: "OpenPGP public key",
    explain: {
      minimal: "Public key",
      standard: "A base64-encoded OpenPGP public key for this mailbox.",
      detailed:
        "The OpenPGP transferable public key packet (RFC 7929), base64-encoded, published so mail clients can discover it without a keyserver.",
    },
  },
];

type SmimeaFields = ParsedFieldValues & {
  usage: string;
  selector: string;
  matchingType: string;
  certData: string;
};

const parseSmimea: RrParser<SmimeaFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 3);
  if (!split || split.rest.length === 0) return null;
  const [usage, selector, matchingType] = split.head;
  if (![usage, selector, matchingType].every(isInteger)) return null;
  return { usage, selector, matchingType, certData: joinBlob(split.rest) };
};

const SMIMEA_FIELDS: RrFieldMeta[] = [
  {
    key: "usage",
    label: "Certificate usage",
    explain: {
      minimal: "Usage",
      standard: "How the certificate association should be used to validate the S/MIME chain.",
      detailed: "Same usage codes as TLSA (RFC 8162): 0/1 = trust anchor, 2/3 = direct pin.",
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
      detailed: "0 = exact match; 1 = SHA-256 hash; 2 = SHA-512 hash.",
    },
  },
  {
    key: "certData",
    label: "Certificate association data",
    explain: {
      minimal: "Certificate/key/hash data",
      standard: "The S/MIME certificate, public key, or hash to compare against, as hex.",
      detailed:
        "Hex-encoded data for DANE S/MIME validation (RFC 8162), analogous to TLSA but keyed by email address hash instead of hostname.",
    },
  },
];

registerRrTypes({
  CERT: { parse: parseCert, fields: CERT_FIELDS, View: FieldList },
  OPENPGPKEY: { parse: parseBlob, fields: OPENPGPKEY_FIELDS, View: FieldList },
  SMIMEA: { parse: parseSmimea, fields: SMIMEA_FIELDS, View: FieldList },
});
