import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, takePositional, tokenize } from "../tokenize";

type CsyncFields = ParsedFieldValues & {
  serial: string;
  flags: string;
  typeBitmaps: string[];
};

const parseCsync: RrParser<CsyncFields> = (raw) => {
  const tokens = tokenize(raw);
  const split = takePositional(tokens, 2);
  if (!split || split.rest.length === 0) return null;
  const [serial, flags] = split.head;
  if (!isInteger(serial) || !isInteger(flags)) return null;
  return { serial, flags, typeBitmaps: split.rest };
};

const CSYNC_FIELDS: RrFieldMeta[] = [
  {
    key: "serial",
    label: "SOA serial",
    explain: {
      minimal: "Zone version",
      standard: "The child zone's SOA serial at the time this hint was published.",
      detailed:
        "Lets the parent (or a provisioning system) confirm it is synchronizing from a zone state at least this recent (RFC 7477).",
    },
  },
  {
    key: "flags",
    label: "Flags",
    explain: {
      minimal: "Flags",
      standard: "Bit 0 (immediate) and bit 1 (SOA-minimum) control how the parent should apply the hint.",
      detailed:
        "Bit 0 ('immediate') asks the parent to apply the change right away; bit 1 ('soaminimum') asks it to wait until the child's serial reaches at least the value above.",
    },
  },
  {
    key: "typeBitmaps",
    label: "Record types to sync",
    explain: {
      minimal: "Types to copy",
      standard: "Which record types (e.g. NS, A, AAAA) the parent should copy from the child.",
      detailed: "The set of RR types the child is asking the parent to synchronize from its own copy of those records.",
    },
  },
];

registerRrTypes({
  CSYNC: { parse: parseCsync, fields: CSYNC_FIELDS, View: FieldList },
});
