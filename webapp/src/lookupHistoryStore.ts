import { STORES, openDb } from "./webdnsDb";
import { RECORD_TYPES } from "./recordTypes";
import type { DnsRecordResult, LookupHistoryEntry } from "./types";

const MAX_HISTORY = 100;

function typesKey(recordTypes: string[]): string {
  return [...recordTypes].sort().join(",");
}

function conventionKey(entry: LookupHistoryEntry): string {
  return JSON.stringify({
    enumMode: entry.enumMode === true,
    srvFields: entry.srvFields ?? null,
    tlsaFields: entry.tlsaFields ?? null,
  });
}

function entriesMatch(a: LookupHistoryEntry, b: LookupHistoryEntry): boolean {
  return (
    a.domain === b.domain &&
    a.dnsServerAddress === b.dnsServerAddress &&
    typesKey(a.recordTypes) === typesKey(b.recordTypes) &&
    conventionKey(a) === conventionKey(b)
  );
}

/** Builds the record to persist for a fresh (non-duplicate) history entry. */
export function buildHistoryRecord(
  entry: LookupHistoryInput,
  timestamp: string = new Date().toISOString()
): Omit<LookupHistoryEntry, "id"> {
  return {
    domain: entry.domain,
    recordTypes: [...entry.recordTypes],
    dnsServerAddress: entry.dnsServerAddress,
    dnsServerResolved: entry.dnsServerResolved,
    enumMode: entry.enumMode,
    srvFields: entry.srvFields,
    tlsaFields: entry.tlsaFields,
    results: entry.results,
    responseError: entry.responseError,
    timestamp,
  };
}

/** When a new lookup matches the most recent history entry (same query),
 *  refresh it in place rather than adding a duplicate row — carrying over its
 *  `id` but replacing every other field with the latest query's data,
 *  including `results`/`responseError` (previously only `timestamp` was
 *  updated here, which silently discarded the newest results). */
export function mergeHistoryRecord(
  existing: LookupHistoryEntry,
  next: Omit<LookupHistoryEntry, "id">
): LookupHistoryEntry {
  return { ...next, id: existing.id };
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
  const record = buildHistoryRecord(entry);

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.history, "readwrite");
    const store = tx.objectStore(STORES.history);

    const latestReq = store.index("timestamp").openCursor(null, "prev");
    let saved: LookupHistoryEntry = record;
    latestReq.onsuccess = () => {
      const cursor = latestReq.result;
      if (cursor && entriesMatch(cursor.value, record)) {
        saved = mergeHistoryRecord(cursor.value, record);
        store.put(saved);
      } else {
        store.add(record);
      }

      pruneOld(store).catch(reject);
    };
    latestReq.onerror = () => reject(latestReq.error);

    tx.oncomplete = () => resolve(saved);
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

// --- Import / export (JSON array or NDJSON/JSONL) ---

export type HistoryExportEntry = Omit<LookupHistoryEntry, "id">;

export async function exportHistory(): Promise<HistoryExportEntry[]> {
  const entries = await listHistory();
  return entries.map(({ id: _id, ...rest }) => rest);
}

function isValidDnsRecordResult(value: unknown): value is DnsRecordResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.record_type === "string";
}

/** Validates and normalizes a single raw import entry. Returns `null` if the
 *  entry is missing required fields, so the caller can count it as skipped
 *  without touching storage. Pure — no IndexedDB access — so it's directly
 *  unit-testable. */
export function parseHistoryImportEntry(raw: unknown): LookupHistoryInput | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;

  const domain = typeof entry.domain === "string" ? entry.domain.trim() : "";
  const recordTypes = Array.isArray(entry.recordTypes)
    ? entry.recordTypes.filter((type): type is string => typeof type === "string")
    : [];
  const validRecordTypes = new Set(RECORD_TYPES);
  if (!domain || recordTypes.length === 0 || !recordTypes.every((type) => validRecordTypes.has(type))) {
    return null;
  }

  const dnsServerAddress = typeof entry.dnsServerAddress === "string" ? entry.dnsServerAddress : "";
  const dnsServerResolved =
    typeof entry.dnsServerResolved === "string" ? entry.dnsServerResolved : dnsServerAddress;

  const results = Array.isArray(entry.results) ? entry.results.filter(isValidDnsRecordResult) : undefined;
  const responseError = typeof entry.responseError === "string" ? entry.responseError : undefined;

  const srvFields =
    entry.srvFields && typeof entry.srvFields === "object"
      ? {
          service: typeof (entry.srvFields as Record<string, unknown>).service === "string"
            ? (entry.srvFields as Record<string, string>).service
            : "",
          protocol: typeof (entry.srvFields as Record<string, unknown>).protocol === "string"
            ? (entry.srvFields as Record<string, string>).protocol
            : "",
        }
      : undefined;

  const tlsaFields =
    entry.tlsaFields && typeof entry.tlsaFields === "object"
      ? {
          port: typeof (entry.tlsaFields as Record<string, unknown>).port === "string"
            ? (entry.tlsaFields as Record<string, string>).port
            : "",
          transport: typeof (entry.tlsaFields as Record<string, unknown>).transport === "string"
            ? (entry.tlsaFields as Record<string, string>).transport
            : "",
        }
      : undefined;

  return {
    domain,
    recordTypes,
    dnsServerAddress,
    dnsServerResolved,
    enumMode: entry.enumMode === true,
    srvFields,
    tlsaFields,
    results,
    responseError,
  };
}

/** Accepts either a JSON array of entries or NDJSON/JSONL text (one JSON
 *  object per line) already split into raw values by the caller. */
export async function importHistory(
  rawEntries: unknown[]
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.history, "readwrite");
    const store = tx.objectStore(STORES.history);

    for (const raw of rawEntries) {
      const parsed = parseHistoryImportEntry(raw);
      if (!parsed) {
        skipped += 1;
        continue;
      }
      const rawTimestamp = (raw as Record<string, unknown>).timestamp;
      const timestamp =
        typeof rawTimestamp === "string" && !Number.isNaN(Date.parse(rawTimestamp))
          ? rawTimestamp
          : new Date().toISOString();
      store.add(buildHistoryRecord(parsed, timestamp));
      added += 1;
    }

    pruneOld(store).catch(reject);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return { added, skipped };
}
