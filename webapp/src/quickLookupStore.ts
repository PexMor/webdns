import { STORES, runStore } from "./webdnsDb";
import type { QuickLookup, QuickLookupInput } from "./types";

function newId(): string {
  return crypto.randomUUID();
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
    }
  >
> {
  const items = await listQuickLookups();
  return items.map(({ name, domain, recordTypes, includeDnsServer, dnsServerAddress }) => ({
    name,
    domain,
    recordTypes,
    includeDnsServer,
    ...(includeDnsServer && dnsServerAddress ? { dnsServerAddress } : {}),
  }));
}
