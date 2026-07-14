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
  getAutoFoldRecordTypes,
  initAutoFoldRecordTypes,
  setAutoFoldRecordTypes,
} from "./queryFormPrefsStore";

describe("queryFormPrefsStore", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("defaults to not folding record types", async () => {
    expect(await getAutoFoldRecordTypes()).toBe(false);
    expect(await initAutoFoldRecordTypes()).toBe(false);
  });

  it("round-trips an enabled preference", async () => {
    const saved = await setAutoFoldRecordTypes(true);
    expect(saved).toBe(true);
    expect(await getAutoFoldRecordTypes()).toBe(true);
  });

  it("round-trips back to disabled", async () => {
    await setAutoFoldRecordTypes(true);
    await setAutoFoldRecordTypes(false);
    expect(await getAutoFoldRecordTypes()).toBe(false);
  });
});
