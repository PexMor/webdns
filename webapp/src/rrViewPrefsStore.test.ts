import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, { key: string; value: string; updatedAt?: string }>();

vi.mock("./webdnsDb", () => ({
  STORES: { prefs: "preferences" },
  runStore: (
    _storeName: string,
    _mode: IDBTransactionMode,
    fn: (store: any) => unknown
  ) => {
    const fakeStore = {
      get: (key: string) => {
        const req: any = {};
        queueMicrotask(() => {
          req.result = memory.get(key) ?? undefined;
          req.onsuccess?.();
        });
        return req;
      },
      put: (record: { key: string; value: string; updatedAt?: string }) => {
        memory.set(record.key, record);
      },
    };
    return Promise.resolve(fn(fakeStore));
  },
}));

import {
  getRrDefaultViewMode,
  getRrDetailLevel,
  initRrViewPrefs,
  setRrDefaultViewMode,
  setRrDetailLevel,
} from "./rrViewPrefsStore";

describe("rrViewPrefsStore", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("defaults to standard detail level and parsed view mode", async () => {
    expect(await getRrDetailLevel()).toBe("standard");
    expect(await getRrDefaultViewMode()).toBe("parsed");
  });

  it("round-trips a detail level change", async () => {
    const saved = await setRrDetailLevel("detailed");
    expect(saved).toBe("detailed");
    expect(await getRrDetailLevel()).toBe("detailed");
  });

  it("round-trips a view mode change", async () => {
    const saved = await setRrDefaultViewMode("raw");
    expect(saved).toBe("raw");
    expect(await getRrDefaultViewMode()).toBe("raw");
  });

  it("rejects an invalid detail level", async () => {
    await expect(setRrDetailLevel("extreme")).rejects.toThrow();
  });

  it("rejects an invalid view mode", async () => {
    await expect(setRrDefaultViewMode("both")).rejects.toThrow();
  });

  it("initRrViewPrefs returns both persisted preferences together", async () => {
    await setRrDetailLevel("minimal");
    await setRrDefaultViewMode("raw");
    expect(await initRrViewPrefs()).toEqual({ detailLevel: "minimal", defaultViewMode: "raw" });
  });
});
