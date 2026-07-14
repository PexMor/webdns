import { STORES, runStore } from "./webdnsDb";
import type { PreferenceRecord } from "./types";

const AUTO_FOLD_RECORD_TYPES_KEY = "autoFoldRecordTypes";
const DEFAULT_AUTO_FOLD_RECORD_TYPES = false;

export async function getAutoFoldRecordTypes(): Promise<boolean> {
  const record = await runStore<PreferenceRecord<boolean> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<boolean> | null>((resolve, reject) => {
        const req = store.get(AUTO_FOLD_RECORD_TYPES_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );

  return typeof record?.value === "boolean" ? record.value : DEFAULT_AUTO_FOLD_RECORD_TYPES;
}

export async function setAutoFoldRecordTypes(value: boolean): Promise<boolean> {
  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({
      key: AUTO_FOLD_RECORD_TYPES_KEY,
      value,
      updatedAt: new Date().toISOString(),
    });
  });
  return value;
}

export async function initAutoFoldRecordTypes(): Promise<boolean> {
  return getAutoFoldRecordTypes();
}
