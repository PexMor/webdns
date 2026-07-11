import { STORES, runStore } from "./webdnsDb";
import type { PreferenceRecord, WsHeader } from "./types";

const WS_HEADERS_PREF = "wsConnectionHeaders";
const API_KEY_PREF = "apiKey";
const LEGACY_STORAGE_KEY = "dns_api_key";

export const BUILTIN_APIKEY_NAME = "apikey";

interface HeaderInput {
  name?: string;
  value?: string;
  enabled?: boolean;
  builtin?: boolean;
}

function normalizeHeader(entry: HeaderInput): WsHeader {
  return {
    name: String(entry?.name ?? "").trim(),
    value: String(entry?.value ?? ""),
    enabled: entry?.enabled !== false,
    builtin: Boolean(entry?.builtin),
  };
}

function isValidHeaderEntry(entry: WsHeader): boolean {
  return Boolean(entry?.name);
}

async function readLegacyApiKeyFromDb(): Promise<string | null> {
  const record = await runStore<PreferenceRecord<string> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<string> | null>((resolve, reject) => {
        const req = store.get(API_KEY_PREF);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );

  if (record?.value) {
    return record.value;
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  return legacy || null;
}

async function readHeadersRaw(): Promise<WsHeader[] | null> {
  const record = await runStore<PreferenceRecord<WsHeader[]> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<WsHeader[]> | null>((resolve, reject) => {
        const req = store.get(WS_HEADERS_PREF);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );

  if (!Array.isArray(record?.value)) {
    return null;
  }

  return record.value.map(normalizeHeader).filter((entry) => entry.name);
}

async function writeHeaders(headers: HeaderInput[]): Promise<WsHeader[]> {
  const normalized = headers.map(normalizeHeader).filter((entry) => entry.name);
  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({
      key: WS_HEADERS_PREF,
      value: normalized,
      updatedAt: new Date().toISOString(),
    });
  });
  return normalized;
}

export function hasEnabledCredentials(headers: WsHeader[]): boolean {
  return headers.some((header) => header.enabled && header.value);
}

export async function migrateLegacyApiKey(): Promise<WsHeader[]> {
  const existing = await readHeadersRaw();
  if (existing && existing.length > 0) {
    return existing;
  }

  const legacy = await readLegacyApiKeyFromDb();
  if (!legacy) {
    return [];
  }

  return writeHeaders([
    {
      name: BUILTIN_APIKEY_NAME,
      value: legacy,
      enabled: true,
      builtin: true,
    },
  ]);
}

export async function listWsHeaders(): Promise<WsHeader[]> {
  const headers = await readHeadersRaw();
  if (headers) {
    return headers;
  }
  return migrateLegacyApiKey();
}

export async function setWsHeaders(headers: HeaderInput[]): Promise<WsHeader[]> {
  return writeHeaders(headers);
}

export async function addWsHeader(
  name: string,
  value?: string,
  { builtin = false }: { builtin?: boolean } = {}
): Promise<WsHeader[]> {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    throw new Error("Header name cannot be empty");
  }

  const headers = await listWsHeaders();
  const index = headers.findIndex(
    (entry) => entry.name.toLowerCase() === trimmedName.toLowerCase()
  );

  const next: WsHeader = {
    name: trimmedName,
    value: value ?? "",
    enabled: true,
    builtin: builtin || trimmedName.toLowerCase() === BUILTIN_APIKEY_NAME,
  };

  if (index >= 0) {
    headers[index] = { ...headers[index], ...next };
  } else {
    headers.push(next);
  }

  return writeHeaders(headers);
}

export async function updateWsHeader(
  name: string,
  updates: Partial<WsHeader>
): Promise<WsHeader[]> {
  const headers = await listWsHeaders();
  const index = headers.findIndex(
    (entry) => entry.name.toLowerCase() === name.toLowerCase()
  );
  if (index < 0) {
    throw new Error(`Header "${name}" not found`);
  }

  headers[index] = normalizeHeader({ ...headers[index], ...updates, name: headers[index].name });
  return writeHeaders(headers);
}

export async function removeWsHeader(name: string): Promise<WsHeader[]> {
  const headers = await listWsHeaders();
  const next = headers.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
  return writeHeaders(next);
}

export async function upsertBuiltinApiKey(value: string): Promise<WsHeader[]> {
  return addWsHeader(BUILTIN_APIKEY_NAME, value, { builtin: true });
}

export async function clearBuiltinApiKey(): Promise<WsHeader[]> {
  return removeWsHeader(BUILTIN_APIKEY_NAME);
}

export async function exportWsHeaders(): Promise<Pick<WsHeader, "name" | "value" | "enabled">[]> {
  const headers = await listWsHeaders();
  return headers.map(({ name, value, enabled }) => ({
    name,
    value,
    enabled,
  }));
}

export async function importWsHeaders(
  entries: HeaderInput[],
  { merge = true }: { merge?: boolean } = {}
): Promise<{ added: number; updated: number }> {
  if (!Array.isArray(entries)) {
    throw new Error("Expected a JSON array.");
  }

  const parsed = entries.map(normalizeHeader).filter(isValidHeaderEntry);
  if (!merge) {
    const written = await writeHeaders(parsed);
    return { added: written.length, updated: 0 };
  }

  const headers = await listWsHeaders();
  const byName = new Map(headers.map((entry) => [entry.name.toLowerCase(), entry]));
  let added = 0;
  let updated = 0;

  for (const entry of parsed) {
    const key = entry.name.toLowerCase();
    if (byName.has(key)) {
      byName.set(key, { ...byName.get(key)!, ...entry });
      updated += 1;
    } else {
      byName.set(key, entry);
      added += 1;
    }
  }

  await writeHeaders(Array.from(byName.values()));
  return { added, updated };
}
