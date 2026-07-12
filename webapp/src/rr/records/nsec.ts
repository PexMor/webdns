import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, takePositional, tokenize } from "../tokenize";

type NsecFields = ParsedFieldValues & {
  nextDomainName: string;
  typeBitmaps: string[];
};

const parseNsec: RrParser<NsecFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 1);
  if (!split || split.rest.length === 0) return null;
  return { nextDomainName: split.head[0], typeBitmaps: split.rest };
};

const NSEC_FIELDS: RrFieldMeta[] = [
  {
    key: "nextDomainName",
    label: "Next domain name",
    explain: {
      minimal: "Next name",
      standard: "The next existing name in the zone's canonical (sorted) order.",
      detailed:
        "Together with the owner name, this proves no names exist between the two in canonical order, authenticating the denial of existence (RFC 4034).",
    },
  },
  {
    key: "typeBitmaps",
    label: "Record types present",
    explain: {
      minimal: "Types at this name",
      standard: "The record types that exist at this owner name.",
      detailed:
        "The set of RR types present at the owner name, proving any type not listed here does not exist for this name.",
    },
  },
];

type Nsec3Fields = ParsedFieldValues & {
  hashAlgorithm: string;
  flags: string;
  iterations: string;
  salt: string;
  nextHashedOwnerName: string;
  typeBitmaps: string[];
};

const parseNsec3: RrParser<Nsec3Fields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 5);
  if (!split || split.rest.length === 0) return null;
  const [hashAlgorithm, flags, iterations, salt, nextHashedOwnerName] = split.head;
  if (![hashAlgorithm, flags, iterations].every(isInteger)) return null;
  return {
    hashAlgorithm,
    flags,
    iterations,
    salt,
    nextHashedOwnerName,
    typeBitmaps: split.rest,
  };
};

const NSEC3_FIELDS: RrFieldMeta[] = [
  {
    key: "hashAlgorithm",
    label: "Hash algorithm",
    explain: {
      minimal: "Hash algorithm",
      standard: "The hash function used to obscure owner names (1 = SHA-1).",
      detailed: "IANA NSEC3 hash algorithm number; 1 (SHA-1) is currently the only defined value.",
    },
  },
  {
    key: "flags",
    label: "Flags",
    explain: {
      minimal: "Flags",
      standard: "Bit 0 (Opt-Out) means unsigned delegations may be skipped without an NSEC3 record.",
      detailed: "An 8-bit flags field; only the low-order Opt-Out bit is currently defined (RFC 5155).",
    },
  },
  {
    key: "iterations",
    label: "Iterations",
    explain: {
      minimal: "Hash iterations",
      standard: "How many extra times the hash function was applied, to slow down dictionary attacks.",
      detailed: "Additional hash iterations beyond the first, trading off validation cost against resistance to zone enumeration.",
    },
  },
  {
    key: "salt",
    label: "Salt",
    explain: {
      minimal: "Hash salt",
      standard: "A hex salt mixed into the hash so precomputed tables can't be reused across zones ('-' = none).",
      detailed: "Hex-encoded salt value included in every iteration of the hash; '-' indicates no salt is used.",
    },
  },
  {
    key: "nextHashedOwnerName",
    label: "Next hashed owner name",
    explain: {
      minimal: "Next hash",
      standard: "The next hashed name in canonical order, proving no name hashes to a value in between.",
      detailed:
        "Base32-encoded hash of the next owner name in hashed order, authenticating denial of existence without revealing actual names (RFC 5155).",
    },
  },
  {
    key: "typeBitmaps",
    label: "Record types present",
    explain: {
      minimal: "Types at this name",
      standard: "The record types that exist at the (hashed) owner name.",
      detailed: "The set of RR types present at the name whose hash matches this record's owner name.",
    },
  },
];

type Nsec3ParamFields = ParsedFieldValues & {
  hashAlgorithm: string;
  flags: string;
  iterations: string;
  salt: string;
};

const parseNsec3Param: RrParser<Nsec3ParamFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length !== 4) return null;
  const [hashAlgorithm, flags, iterations, salt] = tokens;
  if (![hashAlgorithm, flags, iterations].every(isInteger)) return null;
  return { hashAlgorithm, flags, iterations, salt };
};

const NSEC3PARAM_FIELDS: RrFieldMeta[] = [
  {
    key: "hashAlgorithm",
    label: "Hash algorithm",
    explain: {
      minimal: "Hash algorithm",
      standard: "The hash function used for NSEC3 records in this zone (1 = SHA-1).",
      detailed: "IANA NSEC3 hash algorithm number, matching the NSEC3 records published in the zone.",
    },
  },
  {
    key: "flags",
    label: "Flags",
    explain: {
      minimal: "Flags",
      standard: "Reserved for future use; not used to control lookups of this record directly.",
      detailed: "Published at the zone apex for reference; resolvers use the NSEC3 records themselves, not this record, to validate.",
    },
  },
  {
    key: "iterations",
    label: "Iterations",
    explain: {
      minimal: "Hash iterations",
      standard: "The iteration count used by NSEC3 records in this zone.",
      detailed: "Must match the iterations value used when computing every NSEC3 record's hashes in the zone.",
    },
  },
  {
    key: "salt",
    label: "Salt",
    explain: {
      minimal: "Hash salt",
      standard: "The salt used by NSEC3 records in this zone ('-' = none).",
      detailed: "Hex-encoded salt shared by every NSEC3 record in the zone; '-' indicates no salt is used.",
    },
  },
];

registerRrTypes({
  NSEC: { parse: parseNsec, fields: NSEC_FIELDS, View: FieldList },
  NSEC3: { parse: parseNsec3, fields: NSEC3_FIELDS, View: FieldList },
  NSEC3PARAM: { parse: parseNsec3Param, fields: NSEC3PARAM_FIELDS, View: FieldList },
});
