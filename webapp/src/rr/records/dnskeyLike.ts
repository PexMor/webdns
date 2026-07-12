import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, joinBlob, takePositional, tokenize } from "../tokenize";

type DnskeyFields = ParsedFieldValues & {
  flags: string;
  protocol: string;
  algorithm: string;
  publicKey: string;
};

const parseDnskey: RrParser<DnskeyFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 3);
  if (!split || split.rest.length === 0) return null;
  const [flags, protocol, algorithm] = split.head;
  if (![flags, protocol, algorithm].every(isInteger)) return null;
  return { flags, protocol, algorithm, publicKey: joinBlob(split.rest) };
};

function dnskeyFields(kind: "DNSKEY" | "CDNSKEY" | "KEY"): RrFieldMeta[] {
  const zoneKeyNote =
    kind === "KEY"
      ? "Legacy general-purpose key record from pre-DNSSEC designs; largely superseded by DNSKEY."
      : "Bit 8 (0x0100, 'Zone Key') set means this key may sign the zone; bit 16 (0x0001, 'Secure Entry Point') marks a key-signing key.";
  return [
    {
      key: "flags",
      label: "Flags",
      explain: {
        minimal: "Key flags",
        standard: "Indicates whether this is a zone-signing key and/or a key-signing key.",
        detailed: zoneKeyNote,
      },
    },
    {
      key: "protocol",
      label: "Protocol",
      explain: {
        minimal: "Protocol",
        standard: "Always 3 for DNSSEC; other values make the key invalid.",
        detailed: "Fixed at 3 per RFC 4034; any other value means the record must be treated as invalid.",
      },
    },
    {
      key: "algorithm",
      label: "Algorithm",
      explain: {
        minimal: "Signing algorithm",
        standard: "The DNSSEC algorithm number this key uses (e.g. 8 = RSA/SHA-256, 13 = ECDSA P-256).",
        detailed: "IANA DNSSEC algorithm number identifying the signing algorithm and key format.",
      },
    },
    {
      key: "publicKey",
      label: "Public key",
      explain: {
        minimal: "Public key material",
        standard: "The base64-encoded public key used to verify RRSIG signatures over this zone.",
        detailed:
          "The zone's public key, base64-encoded in the format defined by its algorithm. Resolvers use it to validate RRSIG records; it is not decoded further here.",
      },
    },
  ];
}

registerRrTypes({
  DNSKEY: { parse: parseDnskey, fields: dnskeyFields("DNSKEY"), View: FieldList },
  CDNSKEY: { parse: parseDnskey, fields: dnskeyFields("CDNSKEY"), View: FieldList },
  KEY: { parse: parseDnskey, fields: dnskeyFields("KEY"), View: FieldList },
});
