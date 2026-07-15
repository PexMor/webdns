import { STORES, runStore } from "./webdnsDb";
import type { PreferenceRecord } from "./types";

const LEGACY_AUTO_FOLD_RECORD_TYPES_KEY = "autoFoldRecordTypes";
const EXPAND_RECORD_TYPES_BY_DEFAULT_KEY = "expandRecordTypesByDefault";
const DEFAULT_EXPAND_RECORD_TYPES_BY_DEFAULT = false;

function readPrefBoolean(key: string): Promise<boolean | null> {
  return runStore<PreferenceRecord<boolean> | null>(STORES.prefs, "readonly", (store) => {
    return new Promise<PreferenceRecord<boolean> | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }).then((record) => (typeof record?.value === "boolean" ? record.value : null));
}

function writePrefBoolean(key: string, value: boolean): Promise<void> {
  return runStore(STORES.prefs, "readwrite", (store) => {
    store.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function getExpandRecordTypesByDefault(): Promise<boolean> {
  const current = await readPrefBoolean(EXPAND_RECORD_TYPES_BY_DEFAULT_KEY);
  if (current !== null) return current;

  // One-time migration: the legacy "collapse after submit" toggle is the
  // inverse of "stay expanded by default" — invert it so a user who had
  // opted into folding keeps a folded experience under the new model.
  const legacy = await readPrefBoolean(LEGACY_AUTO_FOLD_RECORD_TYPES_KEY);
  if (legacy !== null) {
    const migrated = !legacy;
    await writePrefBoolean(EXPAND_RECORD_TYPES_BY_DEFAULT_KEY, migrated);
    return migrated;
  }

  return DEFAULT_EXPAND_RECORD_TYPES_BY_DEFAULT;
}

export async function setExpandRecordTypesByDefault(value: boolean): Promise<boolean> {
  await writePrefBoolean(EXPAND_RECORD_TYPES_BY_DEFAULT_KEY, value);
  return value;
}

export async function initExpandRecordTypesByDefault(): Promise<boolean> {
  return getExpandRecordTypesByDefault();
}
