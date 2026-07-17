import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DemoAutoplay,
  dedupeDemoEntries,
  demoNextStepIndex,
  findDemoEntryIndex,
  findDemoMatch,
  loadDemoDataset,
  replayDemoEntry,
} from "./demoMode";
import type { HistoryExportEntry } from "./lookupHistoryStore";

const sampleEntry: HistoryExportEntry = {
  domain: "example.com",
  recordTypes: ["A", "AAAA"],
  dnsServerAddress: "1.1.1.1",
  dnsServerResolved: "1.1.1.1",
  timestamp: "2026-07-17T10:00:00.000Z",
  results: [{ record_type: "A", records: ["93.184.216.34"] }],
};

describe("loadDemoDataset", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses JSONL demo files", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `${JSON.stringify(sampleEntry)}\n${JSON.stringify({ ...sampleEntry, domain: "other.test", recordTypes: ["MX"] })}\n`,
    }) as unknown as typeof fetch;

    const dataset = await loadDemoDataset("/demo.jsonl");
    expect(dataset.entries).toHaveLength(2);
    expect(dataset.entries[0].domain).toBe("example.com");
  });

  it("parses JSON array demo files", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([sampleEntry]),
    }) as unknown as typeof fetch;

    const dataset = await loadDemoDataset("/demo.json");
    expect(dataset.entries).toHaveLength(1);
  });

  it("throws when no valid entries", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{"domain":"","recordTypes":["A"]}',
    }) as unknown as typeof fetch;

    await expect(loadDemoDataset("/demo.jsonl")).rejects.toThrow(/no valid entries/i);
  });

  it("drops duplicate queries, keeping the first occurrence", async () => {
    const duplicate = {
      ...sampleEntry,
      timestamp: "2026-07-17T10:00:01.000Z",
      results: [{ record_type: "A", records: ["1.2.3.4"] }],
    };
    const unique = { ...sampleEntry, domain: "other.test", recordTypes: ["MX"] };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `${JSON.stringify(sampleEntry)}\n${JSON.stringify(duplicate)}\n${JSON.stringify(unique)}\n`,
    }) as unknown as typeof fetch;

    const dataset = await loadDemoDataset("/demo.jsonl");
    expect(dataset.entries).toHaveLength(2);
    expect(dataset.entries[0].results).toEqual(sampleEntry.results);
    expect(dataset.entries[1].domain).toBe("other.test");
  });
});

describe("dedupeDemoEntries", () => {
  it("treats record type order as identical", () => {
    const first = { ...sampleEntry, recordTypes: ["A", "AAAA"] };
    const duplicate = {
      ...sampleEntry,
      recordTypes: ["AAAA", "A"],
      results: [{ record_type: "AAAA", records: ["::1"] }],
    };

    expect(dedupeDemoEntries([first, duplicate])).toEqual([first]);
  });
});

describe("findDemoMatch", () => {
  const dataset = {
    entries: [
      sampleEntry,
      {
        ...sampleEntry,
        domain: "93.184.216.34",
        recordTypes: ["PTR"],
      },
    ],
  };

  it("matches domain, types, and DNS server", () => {
    const match = findDemoMatch(dataset, {
      domain: "example.com",
      recordTypes: ["AAAA", "A"],
      dnsServerAddress: "1.1.1.1",
      dnsServerResolved: "1.1.1.1",
    });
    expect(match?.domain).toBe("example.com");
  });

  it("returns null when no entry matches", () => {
    const match = findDemoMatch(dataset, {
      domain: "missing.test",
      recordTypes: ["A"],
      dnsServerAddress: "1.1.1.1",
      dnsServerResolved: "1.1.1.1",
    });
    expect(match).toBeNull();
  });
});

describe("findDemoEntryIndex", () => {
  const dataset = {
    entries: [
      sampleEntry,
      {
        ...sampleEntry,
        domain: "93.184.216.34",
        recordTypes: ["PTR"],
      },
    ],
  };

  it("returns the index of a matching entry", () => {
    expect(
      findDemoEntryIndex(dataset, {
        domain: "93.184.216.34",
        recordTypes: ["PTR"],
        dnsServerAddress: "1.1.1.1",
        dnsServerResolved: "1.1.1.1",
      })
    ).toBe(1);
  });

  it("returns -1 when no entry matches", () => {
    expect(
      findDemoEntryIndex(dataset, {
        domain: "missing.test",
        recordTypes: ["A"],
        dnsServerAddress: "1.1.1.1",
        dnsServerResolved: "1.1.1.1",
      })
    ).toBe(-1);
  });
});

describe("replayDemoEntry", () => {
  it("returns stored results under the query name", () => {
    const result = replayDemoEntry(sampleEntry, "example.com");
    expect(result.error).toBeNull();
    expect(result.response).toEqual({
      domain: "example.com",
      results: sampleEntry.results,
    });
  });

  it("returns responseError as error", () => {
    const result = replayDemoEntry(
      { ...sampleEntry, results: undefined, responseError: "timeout" },
      "example.com"
    );
    expect(result.response).toBeNull();
    expect(result.error).toBe("timeout");
  });
});

describe("demoNextStepIndex", () => {
  it("starts at 0 when not started", () => {
    expect(demoNextStepIndex(null, 4)).toBe(0);
  });

  it("advances and wraps", () => {
    expect(demoNextStepIndex(0, 4)).toBe(1);
    expect(demoNextStepIndex(3, 4)).toBe(0);
  });
});

describe("DemoAutoplay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the first step immediately when requested", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const entries = [
      { ...sampleEntry, domain: "one.test" },
      { ...sampleEntry, domain: "two.test" },
    ];

    const autoplay = new DemoAutoplay(entries, 1000, (entry) => {
      seen.push(entry.domain);
    });

    autoplay.start(0, { immediate: true });
    expect(seen).toEqual(["one.test"]);

    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["one.test", "two.test"]);
  });

  it("steps through entries in order and wraps", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const entries = [
      { ...sampleEntry, domain: "one.test" },
      { ...sampleEntry, domain: "two.test" },
    ];

    const autoplay = new DemoAutoplay(entries, 1000, (entry) => {
      seen.push(entry.domain);
    });

    autoplay.start();
    expect(autoplay.isRunning()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["one.test"]);

    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["one.test", "two.test"]);

    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["one.test", "two.test", "one.test"]);

    autoplay.stop();
    expect(autoplay.isRunning()).toBe(false);
  });

  it("emits countdown ticks while waiting for the next step", () => {
    vi.useFakeTimers();
    const countdowns: number[] = [];
    const autoplay = new DemoAutoplay(
      [{ ...sampleEntry, domain: "one.test" }],
      5000,
      () => {},
      (seconds) => countdowns.push(seconds)
    );

    autoplay.start(0, { immediate: true });
    expect(countdowns).toContain(5);

    vi.advanceTimersByTime(2000);
    expect(countdowns).toContain(3);

    autoplay.stop();
    expect(countdowns[countdowns.length - 1]).toBe(0);
  });

  it("resume restarts from the next index after stop", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const entries = [
      { ...sampleEntry, domain: "one.test" },
      { ...sampleEntry, domain: "two.test" },
    ];
    const autoplay = new DemoAutoplay(entries, 500, (entry) => seen.push(entry.domain));

    autoplay.start();
    vi.advanceTimersByTime(500);
    autoplay.stop();
    vi.advanceTimersByTime(1500);
    expect(seen).toEqual(["one.test"]);

    autoplay.resume();
    vi.advanceTimersByTime(500);
    expect(seen).toEqual(["one.test", "two.test"]);
  });

  it("alignAfterManualStep continues from the next index on resume", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const entries = [
      { ...sampleEntry, domain: "one.test" },
      { ...sampleEntry, domain: "two.test" },
      { ...sampleEntry, domain: "three.test" },
    ];
    const autoplay = new DemoAutoplay(entries, 500, (entry) => seen.push(entry.domain));

    autoplay.start(0, { immediate: true });
    expect(seen).toEqual(["one.test"]);
    autoplay.alignAfterManualStep(1);
    autoplay.stop();
    autoplay.resume();
    vi.advanceTimersByTime(500);
    expect(seen).toEqual(["one.test", "three.test"]);
  });
});
