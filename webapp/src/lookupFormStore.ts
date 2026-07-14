import { STORES, runStore } from "./webdnsDb";
import { RECORD_TYPES } from "./recordTypes";
import { DEFAULT_SRV_FIELDS, DEFAULT_TLSA_FIELDS } from "./queryTransforms";
import type { LookupFormState, PreferenceRecord } from "./types";

const LOOKUP_FORM_KEY = "lastLookupForm";
const DEFAULT_RECORD_TYPES = ["A", "AAAA"];

function normalizeRecordTypes(recordTypes: unknown): string[] {
  if (!Array.isArray(recordTypes)) return DEFAULT_RECORD_TYPES;
  const valid = new Set(RECORD_TYPES);
  const filtered = recordTypes.filter((type) => valid.has(type));
  return filtered.length > 0 ? filtered : DEFAULT_RECORD_TYPES;
}

function normalizeSrvFields(srvFields: unknown): { service: string; protocol: string } {
  if (!srvFields || typeof srvFields !== "object") return { ...DEFAULT_SRV_FIELDS };
  const { service, protocol } = srvFields as Record<string, unknown>;
  return {
    service: typeof service === "string" ? service : "",
    protocol: typeof protocol === "string" ? protocol : "",
  };
}

function normalizeTlsaFields(tlsaFields: unknown): { port: string; transport: string } {
  if (!tlsaFields || typeof tlsaFields !== "object") return { ...DEFAULT_TLSA_FIELDS };
  const { port, transport } = tlsaFields as Record<string, unknown>;
  return {
    port: typeof port === "string" ? port : "",
    transport: typeof transport === "string" ? transport : "",
  };
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
    return {
      domain: "",
      recordTypes: DEFAULT_RECORD_TYPES,
      enumMode: false,
      srvFields: { ...DEFAULT_SRV_FIELDS },
      tlsaFields: { ...DEFAULT_TLSA_FIELDS },
    };
  }

  return {
    domain: typeof value.domain === "string" ? value.domain : "",
    recordTypes: normalizeRecordTypes(value.recordTypes),
    enumMode: value.enumMode === true,
    srvFields: normalizeSrvFields(value.srvFields),
    tlsaFields: normalizeTlsaFields(value.tlsaFields),
  };
}

export async function saveLookupForm({
  domain,
  recordTypes,
  enumMode = false,
  srvFields = DEFAULT_SRV_FIELDS,
  tlsaFields = DEFAULT_TLSA_FIELDS,
}: {
  domain: string;
  recordTypes: string[];
  enumMode?: boolean;
  srvFields?: { service: string; protocol: string };
  tlsaFields?: { port: string; transport: string };
}): Promise<LookupFormState & { updatedAt: string }> {
  const payload = {
    domain: typeof domain === "string" ? domain : "",
    recordTypes: normalizeRecordTypes(recordTypes),
    enumMode: enumMode === true,
    srvFields: normalizeSrvFields(srvFields),
    tlsaFields: normalizeTlsaFields(tlsaFields),
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
