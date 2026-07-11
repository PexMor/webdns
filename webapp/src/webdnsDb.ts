const DB_NAME = "webdns";
export const DB_VERSION = 3;

export const STORES = {
  dns: "customDnsServers",
  prefs: "preferences",
  history: "lookupHistory",
  quickLookups: "quickLookups",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.dns)) {
        db.createObjectStore(STORES.dns, { keyPath: "address" });
      }
      if (!db.objectStoreNames.contains(STORES.prefs)) {
        db.createObjectStore(STORES.prefs, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.history)) {
        const history = db.createObjectStore(STORES.history, {
          keyPath: "id",
          autoIncrement: true,
        });
        history.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.quickLookups)) {
        const quickLookups = db.createObjectStore(STORES.quickLookups, { keyPath: "id" });
        quickLookups.createIndex("sortOrder", "sortOrder", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function runStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => T | PromiseLike<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      })
  );
}
