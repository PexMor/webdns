import type { JSX } from "preact";

/** How much inline guidance a parsed record view shows per field. */
export const DETAIL_LEVELS = ["minimal", "standard", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

/** A parsed record's fields, keyed by field name. Multi-valued fields (e.g. TXT
 *  character-strings) use a string array; everything else is a single string. */
export type ParsedFieldValues = Record<string, string | string[]>;

/** Explanation text for a field, one entry per detail level. Levels may be
 *  omitted; the view falls back to the closest available level. */
export type FieldExplain = Partial<Record<DetailLevel, string>>;

export interface RrFieldMeta {
  key: string;
  label: string;
  explain: FieldExplain;
  /** When set, the field's value is a seconds count rendered as a compact
   *  colored d/h/m/s breakdown instead of the raw integer. */
  kind?: "duration-seconds";
}

/** Parses a raw RDATA presentation string into named fields, or returns `null`
 *  if the string doesn't match this record type's expected shape. */
export type RrParser<T extends ParsedFieldValues = ParsedFieldValues> = (
  raw: string
) => T | null;

export interface RrViewProps<T extends ParsedFieldValues = ParsedFieldValues> {
  fields: RrFieldMeta[];
  detailLevel: DetailLevel;
  value: T;
}

export type RrView<T extends ParsedFieldValues = ParsedFieldValues> = (
  props: RrViewProps<T>
) => JSX.Element;

export interface RrTypeEntry<T extends ParsedFieldValues = ParsedFieldValues> {
  parse: RrParser<T>;
  fields: RrFieldMeta[];
  View: RrView<T>;
}

/** Resolves the best available explanation for a field at the requested detail
 *  level, falling back to less-detailed text rather than showing nothing. */
export function resolveExplain(explain: FieldExplain, level: DetailLevel): string | null {
  if (level === "minimal") return explain.minimal ?? null;
  if (level === "standard") return explain.standard ?? explain.minimal ?? null;
  return explain.detailed ?? explain.standard ?? explain.minimal ?? null;
}
