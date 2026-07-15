import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, { key: string; value: boolean; updatedAt?: string }>();

vi.mock("./webdnsDb", () => ({
  STORES: { prefs: "preferences" },
  runStore: (_storeName: string, _mode: IDBTransactionMode, fn: (store: any) => unknown) => {
    const fakeStore = {
      get: (key: string) => {
        const req: any = {};
        queueMicrotask(() => {
          req.result = memory.get(key) ?? undefined;
          req.onsuccess?.();
        });
        return req;
      },
      put: (record: { key: string; value: boolean; updatedAt?: string }) => {
        memory.set(record.key, record);
      },
    };
    return Promise.resolve(fn(fakeStore));
  },
}));

import {
  getExpandRecordTypesByDefault,
  initExpandRecordTypesByDefault,
  setExpandRecordTypesByDefault,
} from "./queryFormPrefsStore";

describe("queryFormPrefsStore", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("defaults to folded (not expanded) when no preference is stored", async () => {
    expect(await getExpandRecordTypesByDefault()).toBe(false);
    expect(await initExpandRecordTypesByDefault()).toBe(false);
  });

  it("round-trips an enabled preference", async () => {
    const saved = await setExpandRecordTypesByDefault(true);
    expect(saved).toBe(true);
    expect(await getExpandRecordTypesByDefault()).toBe(true);
  });

  it("round-trips back to disabled", async () => {
    await setExpandRecordTypesByDefault(true);
    await setExpandRecordTypesByDefault(false);
    expect(await getExpandRecordTypesByDefault()).toBe(false);
  });

  it("migrates the legacy autoFoldRecordTypes=true (fold after submit) to expandRecordTypesByDefault=false", async () => {
    memory.set("autoFoldRecordTypes", {
      key: "autoFoldRecordTypes",
      value: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(await getExpandRecordTypesByDefault()).toBe(false);
    // Migration persists under the new key so subsequent reads don't re-derive it.
    expect(memory.get("expandRecordTypesByDefault")?.value).toBe(false);
  });

  it("migrates the legacy autoFoldRecordTypes=false (never fold) to expandRecordTypesByDefault=true", async () => {
    memory.set("autoFoldRecordTypes", {
      key: "autoFoldRecordTypes",
      value: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(await getExpandRecordTypesByDefault()).toBe(true);
    expect(memory.get("expandRecordTypesByDefault")?.value).toBe(true);
  });

  it("prefers an explicitly stored expandRecordTypesByDefault over the legacy key", async () => {
    memory.set("autoFoldRecordTypes", {
      key: "autoFoldRecordTypes",
      value: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await setExpandRecordTypesByDefault(false);

    expect(await getExpandRecordTypesByDefault()).toBe(false);
  });
});
