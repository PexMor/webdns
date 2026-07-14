import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Fake IndexedDB harness ---
//
// Models just enough of IndexedDB's cursor/transaction semantics for
// lookupHistoryStore.ts's exact usage patterns: `store.count()` and
// `store.index("timestamp").openCursor(...)` are the only requests the real
// code attaches `.onsuccess` to (add/put/delete/clear are treated as
// synchronous mutations, matching how the store code uses them — fire and
// forget, relying on transaction completion rather than per-request
// callbacks). A transaction's `oncomplete` fires once every outstanding
// request "settles" (a cursor's `continue()` re-arms itself before its
// carrying request finishes, so the pending count nets out correctly).
interface FakeRecord {
  id: number;
  [key: string]: unknown;
}

function createFakeDb() {
  let nextId = 1;
  let records: FakeRecord[] = [];

  function byTimestamp(direction: "next" | "prev"): FakeRecord[] {
    const sorted = [...records].sort((a, b) => {
      const ta = String(a.timestamp);
      const tb = String(b.timestamp);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    return direction === "prev" ? sorted.reverse() : sorted;
  }

  function makeRequest(pending: { count: number }, compute: () => unknown) {
    pending.count += 1;
    const req: any = {};
    queueMicrotask(() => {
      req.result = compute();
      try {
        req.onsuccess?.();
      } finally {
        pending.count -= 1;
      }
    });
    return req;
  }

  function makeCursorRequest(pending: { count: number }, items: FakeRecord[]) {
    pending.count += 1;
    const req: any = {};
    let index = -1;
    function emit() {
      index += 1;
      if (index >= items.length) {
        req.result = null;
      } else {
        const record = items[index];
        req.result = {
          value: record,
          primaryKey: record.id,
          continue: () => {
            pending.count += 1;
            queueMicrotask(emit);
          },
        };
      }
      try {
        req.onsuccess?.();
      } finally {
        pending.count -= 1;
      }
    }
    queueMicrotask(emit);
    return req;
  }

  function makeStore(pending: { count: number }) {
    return {
      add: (record: Omit<FakeRecord, "id"> & { id?: number }) => {
        const withId = { ...record, id: nextId++ } as FakeRecord;
        records.push(withId);
        return withId;
      },
      put: (record: FakeRecord) => {
        const idx = records.findIndex((r) => r.id === record.id);
        if (idx >= 0) records[idx] = { ...record };
        else records.push({ ...record, id: record.id ?? nextId++ });
      },
      delete: (id: number) => {
        records = records.filter((r) => r.id !== id);
      },
      clear: () => {
        records = [];
      },
      count: () => makeRequest(pending, () => records.length),
      index: (name: string) => {
        if (name !== "timestamp") throw new Error(`unexpected index ${name}`);
        return {
          openCursor: (_range: unknown, direction?: "next" | "prev") =>
            makeCursorRequest(pending, byTimestamp(direction === "prev" ? "prev" : "next")),
        };
      },
    };
  }

  return {
    reset() {
      records = [];
      nextId = 1;
    },
    snapshot() {
      return [...records];
    },
    transaction() {
      const pending = { count: 0 };
      const store = makeStore(pending);
      const tx: any = { oncomplete: null, onerror: null };
      function poll() {
        queueMicrotask(() => {
          if (pending.count === 0) {
            tx.oncomplete?.();
          } else {
            poll();
          }
        });
      }
      poll();
      return {
        objectStore: () => store,
        get oncomplete() {
          return tx.oncomplete;
        },
        set oncomplete(fn: any) {
          tx.oncomplete = fn;
        },
        get onerror() {
          return tx.onerror;
        },
        set onerror(fn: any) {
          tx.onerror = fn;
        },
      };
    },
  };
}

const fakeDb = createFakeDb();

vi.mock("./webdnsDb", () => ({
  STORES: { history: "lookupHistory" },
  openDb: () => Promise.resolve(fakeDb),
}));

import {
  addHistoryEntry,
  buildHistoryRecord,
  clearHistory,
  exportHistory,
  importHistory,
  listHistory,
  mergeHistoryRecord,
  parseHistoryImportEntry,
} from "./lookupHistoryStore";
import type { LookupHistoryEntry } from "./types";

beforeEach(() => {
  fakeDb.reset();
});

describe("buildHistoryRecord", () => {
  it("builds a record with the given timestamp", () => {
    const record = buildHistoryRecord(
      {
        domain: "example.com",
        recordTypes: ["A"],
        dnsServerAddress: "8.8.8.8",
        dnsServerResolved: "8.8.8.8:53",
        results: [{ record_type: "A", records: ["93.184.216.34"] }],
      },
      "2026-01-01T00:00:00.000Z"
    );
    expect(record).toEqual({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      enumMode: undefined,
      srvFields: undefined,
      tlsaFields: undefined,
      results: [{ record_type: "A", records: ["93.184.216.34"] }],
      responseError: undefined,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("mergeHistoryRecord", () => {
  it("carries over the existing id but replaces every other field, including results", () => {
    const existing: LookupHistoryEntry = {
      id: 42,
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      timestamp: "2026-01-01T00:00:00.000Z",
      results: [{ record_type: "A", records: ["old-value"] }],
    };
    const next = buildHistoryRecord(
      {
        domain: "example.com",
        recordTypes: ["A"],
        dnsServerAddress: "8.8.8.8",
        dnsServerResolved: "8.8.8.8:53",
        results: [{ record_type: "A", records: ["new-value"] }],
      },
      "2026-01-02T00:00:00.000Z"
    );

    const merged = mergeHistoryRecord(existing, next);
    expect(merged.id).toBe(42);
    expect(merged.timestamp).toBe("2026-01-02T00:00:00.000Z");
    // This is the bug this change fixes: results must reflect the newest
    // query, not silently keep the previous entry's stale results.
    expect(merged.results).toEqual([{ record_type: "A", records: ["new-value"] }]);
  });
});

describe("parseHistoryImportEntry", () => {
  it("accepts a well-formed entry", () => {
    const parsed = parseHistoryImportEntry({
      domain: "example.com",
      recordTypes: ["A", "AAAA"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      results: [{ record_type: "A", records: ["93.184.216.34"] }],
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed).toEqual({
      domain: "example.com",
      recordTypes: ["A", "AAAA"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      enumMode: false,
      srvFields: undefined,
      tlsaFields: undefined,
      results: [{ record_type: "A", records: ["93.184.216.34"] }],
      responseError: undefined,
    });
  });

  it("rejects an entry with no domain", () => {
    expect(parseHistoryImportEntry({ recordTypes: ["A"] })).toBeNull();
  });

  it("rejects an entry with an empty recordTypes array", () => {
    expect(parseHistoryImportEntry({ domain: "example.com", recordTypes: [] })).toBeNull();
  });

  it("rejects an entry with an unknown record type", () => {
    expect(
      parseHistoryImportEntry({ domain: "example.com", recordTypes: ["NOTAREALTYPE"] })
    ).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseHistoryImportEntry(null)).toBeNull();
    expect(parseHistoryImportEntry("example.com")).toBeNull();
  });

  it("filters malformed entries out of the results array", () => {
    const parsed = parseHistoryImportEntry({
      domain: "example.com",
      recordTypes: ["A"],
      results: [{ record_type: "A" }, { notARecord: true }],
    });
    expect(parsed?.results).toEqual([{ record_type: "A" }]);
  });
});

describe("addHistoryEntry (fake IndexedDB)", () => {
  it("adds a new entry", async () => {
    const saved = await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      results: [{ record_type: "A", records: ["93.184.216.34"] }],
    });
    expect(saved.domain).toBe("example.com");
    const all = await listHistory();
    expect(all).toHaveLength(1);
    expect(all[0].results).toEqual([{ record_type: "A", records: ["93.184.216.34"] }]);
  });

  it("merges a repeated identical query in place, updating results rather than duplicating", async () => {
    await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      results: [{ record_type: "A", records: ["old-ip"] }],
    });
    await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      results: [{ record_type: "A", records: ["new-ip"] }],
    });

    const all = await listHistory();
    expect(all).toHaveLength(1);
    expect(all[0].results).toEqual([{ record_type: "A", records: ["new-ip"] }]);
  });

  it("does not merge queries for a different domain", async () => {
    await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
    });
    await addHistoryEntry({
      domain: "example.net",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
    });

    const all = await listHistory();
    expect(all).toHaveLength(2);
  });
});

describe("clearHistory (fake IndexedDB)", () => {
  it("removes all entries", async () => {
    await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
    });
    await clearHistory();
    expect(await listHistory()).toHaveLength(0);
  });
});

describe("exportHistory / importHistory (fake IndexedDB)", () => {
  it("exports entries without the internal id", async () => {
    await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
    });
    const exported = await exportHistory();
    expect(exported).toHaveLength(1);
    expect(exported[0]).not.toHaveProperty("id");
    expect(exported[0].domain).toBe("example.com");
  });

  it("imports valid entries and skips invalid ones", async () => {
    const { added, skipped } = await importHistory([
      { domain: "example.com", recordTypes: ["A"], timestamp: "2026-01-01T00:00:00.000Z" },
      { domain: "", recordTypes: ["A"] },
      { recordTypes: ["A"] },
      null,
    ]);
    expect(added).toBe(1);
    expect(skipped).toBe(3);
    const all = await listHistory();
    expect(all).toHaveLength(1);
    expect(all[0].domain).toBe("example.com");
  });

  it("round-trips an export through import into an empty store", async () => {
    await addHistoryEntry({
      domain: "example.com",
      recordTypes: ["A", "AAAA"],
      dnsServerAddress: "8.8.8.8",
      dnsServerResolved: "8.8.8.8:53",
      results: [{ record_type: "A", records: ["93.184.216.34"] }],
    });
    const exported = await exportHistory();

    await clearHistory();
    expect(await listHistory()).toHaveLength(0);

    const { added, skipped } = await importHistory(exported);
    expect(added).toBe(1);
    expect(skipped).toBe(0);
    const all = await listHistory();
    expect(all[0].domain).toBe("example.com");
    expect(all[0].results).toEqual([{ record_type: "A", records: ["93.184.216.34"] }]);
  });
});
