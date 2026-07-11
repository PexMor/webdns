import { STORES, runStore } from "./webdnsDb.js";
import { clearBuiltinApiKey, upsertBuiltinApiKey } from "./wsHeaderStore.js";

const API_KEY_PREF = "apiKey";
const LEGACY_STORAGE_KEY = "dns_api_key";

export async function getApiKey() {
  const record = await runStore(STORES.prefs, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(API_KEY_PREF);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });

  if (record?.value) {
    return record.value;
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    await setApiKey(legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }

  return null;
}

export async function setApiKey(key) {
  if (!key) {
    throw new Error("API key cannot be empty");
  }

  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({ key: API_KEY_PREF, value: key, updatedAt: new Date().toISOString() });
  });
  await upsertBuiltinApiKey(key);
}

export async function clearApiKey() {
  await runStore(STORES.prefs, "readwrite", (store) => {
    store.delete(API_KEY_PREF);
  });
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  await clearBuiltinApiKey();
}
