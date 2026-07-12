import type { ParsedFieldValues, RrTypeEntry } from "./types";

const registry = new Map<string, RrTypeEntry<any>>();

/** Registers a set of `{ TYPE: entry }` pairs. Record type keys are
 *  upper-cased so lookups are case-insensitive. */
export function registerRrTypes(entries: Record<string, RrTypeEntry<any>>): void {
  for (const [type, entry] of Object.entries(entries)) {
    registry.set(type.toUpperCase(), entry);
  }
}

/** Looks up the parser/fields/view entry for a record type, or `undefined`
 *  if no entry is registered for it. */
export function getRrTypeEntry<T extends ParsedFieldValues = ParsedFieldValues>(
  recordType: string
): RrTypeEntry<T> | undefined {
  return registry.get(recordType.toUpperCase());
}
