import { STORES, openDb } from "./webdnsDb";
import type { LookupHistoryEntry } from "./types";

const MAX_HISTORY = 100;

function typesKey(recordTypes: string[]): string {
  return [...recordTypes].sort().join(",");
}

function entriesMatch(a: LookupHistoryEntry, b: LookupHistoryEntry): boolean {
  return (
    a.domain === b.domain &&
    a.dnsServerAddress === b.dnsServerAddress &&
    typesKey(a.recordTypes) === typesKey(b.recordTypes)
  );
}

function getAllNewestFirst(store: IDBObjectStore): Promise<LookupHistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const results: LookupHistoryEntry[] = [];
    const req = store.index("timestamp").openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

function pruneOld(store: IDBObjectStore): Promise<void> {
  return new Promise((resolve, reject) => {
    const countReq = store.count();
    countReq.onsuccess = () => {
      const excess = countReq.result - MAX_HISTORY;
      if (excess <= 0) {
        resolve();
        return;
      }

      let deleted = 0;
      const cursorReq = store.index("timestamp").openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && deleted < excess) {
          store.delete(cursor.primaryKey);
          deleted += 1;
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

export async function listHistory(): Promise<LookupHistoryEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.history, "readonly");
    const store = tx.objectStore(STORES.history);
    getAllNewestFirst(store).then(resolve).catch(reject);
    tx.onerror = () => reject(tx.error);
  });
}

export type LookupHistoryInput = Omit<LookupHistoryEntry, "id" | "timestamp">;

export async function addHistoryEntry(entry: LookupHistoryInput): Promise<LookupHistoryEntry> {
  const record: LookupHistoryEntry = {
    domain: entry.domain,
    recordTypes: [...entry.recordTypes],
    dnsServerAddress: entry.dnsServerAddress,
    dnsServerResolved: entry.dnsServerResolved,
    timestamp: new Date().toISOString(),
  };

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.history, "readwrite");
    const store = tx.objectStore(STORES.history);

    const latestReq = store.index("timestamp").openCursor(null, "prev");
    latestReq.onsuccess = () => {
      const cursor = latestReq.result;
      if (cursor && entriesMatch(cursor.value, record)) {
        store.put({ ...cursor.value, timestamp: record.timestamp });
      } else {
        store.add(record);
      }

      pruneOld(store).catch(reject);
    };
    latestReq.onerror = () => reject(latestReq.error);

    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.history, "readwrite");
    const store = tx.objectStore(STORES.history);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function suggestQuickLookupName(domain: string, recordTypes: string[]): string {
  return `${recordTypes.join("+")} ${domain}`;
}
