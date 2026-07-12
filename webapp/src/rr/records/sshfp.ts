import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, joinBlob, takePositional, tokenize } from "../tokenize";

type SshfpFields = ParsedFieldValues & {
  algorithm: string;
  fpType: string;
  fingerprint: string;
};

const parseSshfp: RrParser<SshfpFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 2);
  if (!split || split.rest.length === 0) return null;
  const [algorithm, fpType] = split.head;
  if (!isInteger(algorithm) || !isInteger(fpType)) return null;
  return { algorithm, fpType, fingerprint: joinBlob(split.rest) };
};

const SSHFP_FIELDS: RrFieldMeta[] = [
  {
    key: "algorithm",
    label: "Algorithm",
    explain: {
      minimal: "Key algorithm",
      standard: "The SSH host key algorithm the fingerprint below was computed from.",
      detailed:
        "1 = RSA, 2 = DSA, 3 = ECDSA, 4 = Ed25519, 6 = Ed448 (IANA SSHFP algorithm numbers).",
    },
  },
  {
    key: "fpType",
    label: "Fingerprint type",
    explain: {
      minimal: "Hash type",
      standard: "The hash algorithm used to compute the fingerprint.",
      detailed: "1 = SHA-1, 2 = SHA-256.",
    },
  },
  {
    key: "fingerprint",
    label: "Fingerprint",
    explain: {
      minimal: "Host key fingerprint",
      standard: "The hashed SSH host key, for clients to verify before trusting a server.",
      detailed:
        "The hex-encoded fingerprint of the server's public host key. SSH clients that support DNSSEC-verified SSHFP can compare this against the key offered at connect time (RFC 4255).",
    },
  },
];

registerRrTypes({
  SSHFP: { parse: parseSshfp, fields: SSHFP_FIELDS, View: FieldList },
});
