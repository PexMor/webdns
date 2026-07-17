import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG, loadConfig, normalizeDemoConfig, normalizeIdentityProxy } from "./loadConfig";

describe("normalizeIdentityProxy", () => {
  it("defaults to disabled when absent", () => {
    expect(normalizeIdentityProxy(undefined)).toEqual({
      enabled: false,
      probePath: "/version",
    });
  });

  it("defaults to disabled when not an object", () => {
    expect(normalizeIdentityProxy("nope")).toEqual({
      enabled: false,
      probePath: "/version",
    });
    expect(normalizeIdentityProxy(42)).toEqual({
      enabled: false,
      probePath: "/version",
    });
    expect(normalizeIdentityProxy(["enabled"])).toEqual({
      enabled: false,
      probePath: "/version",
    });
  });

  it("respects enabled: true with default probePath", () => {
    expect(normalizeIdentityProxy({ enabled: true })).toEqual({
      enabled: true,
      probePath: "/version",
    });
  });

  it("respects a custom probePath", () => {
    expect(normalizeIdentityProxy({ enabled: true, probePath: "/auth-probe.txt" })).toEqual({
      enabled: true,
      probePath: "/auth-probe.txt",
    });
  });

  it("falls back to default probePath when probePath is blank or non-string", () => {
    expect(normalizeIdentityProxy({ enabled: true, probePath: "" }).probePath).toBe("/version");
    expect(normalizeIdentityProxy({ enabled: true, probePath: 123 }).probePath).toBe("/version");
  });
});

describe("normalizeDemoConfig", () => {
  it("defaults to disabled when absent", () => {
    expect(normalizeDemoConfig(undefined)).toEqual(DEFAULT_CONFIG.demo);
  });

  it("defaults to disabled when not an object", () => {
    expect(normalizeDemoConfig("nope")).toEqual(DEFAULT_CONFIG.demo);
  });

  it("respects enabled with autoplay settings", () => {
    expect(
      normalizeDemoConfig({
        enabled: true,
        dataUrl: "/custom.jsonl",
        autoplay: { enabled: true, intervalMs: 3000 },
      })
    ).toEqual({
      enabled: true,
      dataUrl: "/custom.jsonl",
      autoplay: { enabled: true, intervalMs: 3000 },
    });
  });
});

describe("loadConfig", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses a valid identityProxy block from config.json", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wsUrls: ["/ws"],
        dnsServers: [{ label: "Test", address: "1.1.1.1" }],
        identityProxy: { enabled: true, probePath: "/version" },
      }),
    }) as unknown as typeof fetch;

    const config = await loadConfig();
    expect(config.identityProxy).toEqual({ enabled: true, probePath: "/version" });
  });

  it("disables identityProxy when config.json omits it", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wsUrls: ["/ws"],
        dnsServers: [{ label: "Test", address: "1.1.1.1" }],
      }),
    }) as unknown as typeof fetch;

    const config = await loadConfig();
    expect(config.identityProxy).toEqual({ enabled: false, probePath: "/version" });
  });

  it("disables identityProxy when config.json has an invalid identityProxy value", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wsUrls: ["/ws"],
        dnsServers: [{ label: "Test", address: "1.1.1.1" }],
        identityProxy: "yes please",
      }),
    }) as unknown as typeof fetch;

    const config = await loadConfig();
    expect(config.identityProxy).toEqual({ enabled: false, probePath: "/version" });
  });

  it("falls back to the disabled default identityProxy when config.json fails to load", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const config = await loadConfig();
    expect(config.identityProxy).toEqual(DEFAULT_CONFIG.identityProxy);
    expect(config.demo).toEqual(DEFAULT_CONFIG.demo);
  });

  it("parses demo config and keeps empty wsUrls when demo is enabled", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wsUrls: [],
        dnsServers: [{ label: "Cloudflare", address: "1.1.1.1" }],
        demo: { enabled: true, dataUrl: "/demo.jsonl", autoplay: { enabled: true, intervalMs: 4000 } },
      }),
    }) as unknown as typeof fetch;

    const config = await loadConfig();
    expect(config.wsUrls).toEqual([]);
    expect(config.demo).toEqual({
      enabled: true,
      dataUrl: "/demo.jsonl",
      autoplay: { enabled: true, intervalMs: 4000 },
    });
  });

  it("disables demo when config.json has an invalid demo value", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wsUrls: ["/ws"],
        dnsServers: [{ label: "Test", address: "1.1.1.1" }],
        demo: "yes",
      }),
    }) as unknown as typeof fetch;

    const config = await loadConfig();
    expect(config.demo).toEqual(DEFAULT_CONFIG.demo);
  });
});
