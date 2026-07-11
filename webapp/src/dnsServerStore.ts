import { STORES, runStore } from "./webdnsDb";
import type { CustomDnsServer } from "./types";

export async function listCustomServers(): Promise<CustomDnsServer[]> {
  return runStore<CustomDnsServer[]>(STORES.dns, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function addCustomServer(
  address: string,
  label?: string
): Promise<CustomDnsServer> {
  const record: CustomDnsServer = {
    address,
    label: label || address,
    addedAt: new Date().toISOString(),
  };
  return runStore(STORES.dns, "readwrite", (store) => {
    store.put(record);
    return record;
  });
}

export async function removeCustomServer(address: string): Promise<void> {
  return runStore(STORES.dns, "readwrite", (store) => {
    store.delete(address);
  });
}

export async function importCustomServers(
  entries: Array<{ address?: string; label?: string }>,
  existingAddresses: string[]
): Promise<{ added: number; skipped: number }> {
  const known = new Set(existingAddresses);
  let added = 0;
  let skipped = 0;

  await runStore(STORES.dns, "readwrite", (store) => {
    for (const entry of entries) {
      if (!entry?.address || known.has(entry.address)) {
        skipped += 1;
        continue;
      }
      store.put({
        address: entry.address,
        label: entry.label || entry.address,
        addedAt: new Date().toISOString(),
      });
      known.add(entry.address);
      added += 1;
    }
  });

  return { added, skipped };
}

export async function exportCustomServers(): Promise<Pick<CustomDnsServer, "address" | "label">[]> {
  const servers = await listCustomServers();
  return servers.map(({ address, label }) => ({ address, label }));
}
