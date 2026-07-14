import { STORES, runStore } from "./webdnsDb";
import { DEFAULT_SRV_FIELDS, DEFAULT_TLSA_FIELDS } from "./queryTransforms";
import type { QuickLookup, QuickLookupInput } from "./types";

function newId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // crypto.randomUUID requires a secure context (HTTPS or localhost);
  // fall back to crypto.getRandomValues, which is available more broadly.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function sortItems(items: QuickLookup[]): QuickLookup[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function getAll(store: IDBObjectStore): Promise<QuickLookup[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(sortItems(req.result || []));
    req.onerror = () => reject(req.error);
  });
}

function nextSortOrder(items: QuickLookup[]): number {
  if (!items.length) return 0;
  return Math.max(...items.map((item) => item.sortOrder)) + 1;
}

export function normalizeQuickLookup(record: QuickLookup): QuickLookup {
  const includeDnsServer = record.includeDnsServer ?? Boolean(record.dnsServerAddress);
  return {
    ...record,
    includeDnsServer,
    dnsServerAddress: includeDnsServer ? record.dnsServerAddress ?? null : null,
    enumMode: record.enumMode === true,
    srvFields: record.srvFields ?? { ...DEFAULT_SRV_FIELDS },
    tlsaFields: record.tlsaFields ?? { ...DEFAULT_TLSA_FIELDS },
  };
}

export async function listQuickLookups(): Promise<QuickLookup[]> {
  const items = await runStore(STORES.quickLookups, "readonly", getAll);
  return items.map(normalizeQuickLookup);
}

export async function addQuickLookup({
  name,
  domain,
  recordTypes,
  includeDnsServer = false,
  dnsServerAddress = null,
  enumMode = false,
  srvFields = DEFAULT_SRV_FIELDS,
  tlsaFields = DEFAULT_TLSA_FIELDS,
}: QuickLookupInput): Promise<QuickLookup> {
  const existing = await listQuickLookups();
  const include = Boolean(includeDnsServer);
  const record = normalizeQuickLookup({
    id: newId(),
    name: name.trim(),
    domain: domain.trim(),
    recordTypes: [...recordTypes],
    includeDnsServer: include,
    dnsServerAddress: include ? dnsServerAddress ?? null : null,
    enumMode,
    srvFields,
    tlsaFields,
    sortOrder: nextSortOrder(existing),
  });

  await runStore(STORES.quickLookups, "readwrite", (store) => {
    store.put(record);
    return record;
  });

  return record;
}

export async function updateQuickLookup(
  id: string,
  updates: Partial<QuickLookup>
): Promise<QuickLookup | null> {
  const items = await listQuickLookups();
  const current = items.find((item) => item.id === id);
  if (!current) return null;

  const updated = normalizeQuickLookup({
    ...current,
    ...updates,
    id: current.id,
    recordTypes: updates.recordTypes ? [...updates.recordTypes] : current.recordTypes,
  });

  await runStore(STORES.quickLookups, "readwrite", (store) => {
    store.put(updated);
    return updated;
  });

  return updated;
}

export async function removeQuickLookup(id: string): Promise<void> {
  return runStore(STORES.quickLookups, "readwrite", (store) => {
    store.delete(id);
  });
}

export async function reorderQuickLookups(
  id: string,
  direction: "up" | "down"
): Promise<QuickLookup[]> {
  const items = await listQuickLookups();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) return items;

  const a = items[index];
  const b = items[swapIndex];
  const aOrder = a.sortOrder;
  a.sortOrder = b.sortOrder;
  b.sortOrder = aOrder;

  await runStore(STORES.quickLookups, "readwrite", (store) => {
    store.put(a);
    store.put(b);
  });

  return listQuickLookups();
}

export async function importQuickLookups(
  entries: Array<Partial<QuickLookupInput>>
): Promise<{ added: number; skipped: number }> {
  const existing = await listQuickLookups();
  const knownNames = new Set(existing.map((item) => item.name.toLowerCase()));
  let added = 0;
  let skipped = 0;
  let sortOrder = nextSortOrder(existing);

  await runStore(STORES.quickLookups, "readwrite", (store) => {
    for (const entry of entries) {
      const name = entry?.name?.trim();
      const domain = entry?.domain?.trim();
      const recordTypes = entry?.recordTypes;
      const includeDnsServer = entry?.includeDnsServer ?? Boolean(entry?.dnsServerAddress);
      const dnsServerAddress = includeDnsServer ? entry?.dnsServerAddress ?? null : null;

      if (
        !name ||
        !domain ||
        !Array.isArray(recordTypes) ||
        recordTypes.length === 0 ||
        (includeDnsServer && !dnsServerAddress) ||
        knownNames.has(name.toLowerCase())
      ) {
        skipped += 1;
        continue;
      }

      const record = normalizeQuickLookup({
        id: newId(),
        name,
        domain,
        recordTypes: [...recordTypes],
        includeDnsServer,
        dnsServerAddress,
        enumMode: entry?.enumMode,
        srvFields: entry?.srvFields,
        tlsaFields: entry?.tlsaFields,
        sortOrder,
      });
      store.put(record);
      knownNames.add(name.toLowerCase());
      sortOrder += 1;
      added += 1;
    }
  });

  return { added, skipped };
}

export async function exportQuickLookups(): Promise<
  Array<
    Pick<QuickLookup, "name" | "domain" | "recordTypes" | "includeDnsServer"> & {
      dnsServerAddress?: string | null;
      enumMode?: boolean;
      srvFields?: { service: string; protocol: string };
      tlsaFields?: { port: string; transport: string };
    }
  >
> {
  const items = await listQuickLookups();
  return items.map(
    ({ name, domain, recordTypes, includeDnsServer, dnsServerAddress, enumMode, srvFields, tlsaFields }) => ({
      name,
      domain,
      recordTypes,
      includeDnsServer,
      ...(includeDnsServer && dnsServerAddress ? { dnsServerAddress } : {}),
      ...(enumMode ? { enumMode } : {}),
      ...(srvFields && (srvFields.service || srvFields.protocol) ? { srvFields } : {}),
      ...(tlsaFields && (tlsaFields.port || tlsaFields.transport) ? { tlsaFields } : {}),
    })
  );
}
