import { STORES, runStore } from "./webdnsDb";
import { RECORD_TYPES } from "./recordTypes";
import type { LookupFormState, PreferenceRecord } from "./types";

const LOOKUP_FORM_KEY = "lastLookupForm";
const DEFAULT_RECORD_TYPES = ["A", "AAAA"];

function normalizeRecordTypes(recordTypes: unknown): string[] {
  if (!Array.isArray(recordTypes)) return DEFAULT_RECORD_TYPES;
  const valid = new Set(RECORD_TYPES);
  const filtered = recordTypes.filter((type) => valid.has(type));
  return filtered.length > 0 ? filtered : DEFAULT_RECORD_TYPES;
}

export async function getLookupForm(): Promise<LookupFormState> {
  const record = await runStore<PreferenceRecord<LookupFormState> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<LookupFormState> | null>((resolve, reject) => {
        const req = store.get(LOOKUP_FORM_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );

  const value = record?.value;
  if (!value || typeof value !== "object") {
    return { domain: "", recordTypes: DEFAULT_RECORD_TYPES };
  }

  return {
    domain: typeof value.domain === "string" ? value.domain : "",
    recordTypes: normalizeRecordTypes(value.recordTypes),
  };
}

export async function saveLookupForm({
  domain,
  recordTypes,
}: {
  domain: string;
  recordTypes: string[];
}): Promise<LookupFormState & { updatedAt: string }> {
  const payload = {
    domain: typeof domain === "string" ? domain : "",
    recordTypes: normalizeRecordTypes(recordTypes),
    updatedAt: new Date().toISOString(),
  };

  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({
      key: LOOKUP_FORM_KEY,
      value: payload,
    });
  });

  return payload;
}
