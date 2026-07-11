import { afterEach, describe, expect, it, vi } from "vitest";
import { probeSession } from "./authProbe";

interface MockResponseInit {
  type?: ResponseType;
  status?: number;
  ok?: boolean;
  headers?: Record<string, string>;
}

function mockResponse(init: MockResponseInit): Response {
  return {
    type: init.type ?? "basic",
    status: init.status ?? 200,
    ok: init.ok ?? true,
    headers: new Headers(init.headers ?? {}),
  } as Response;
}

describe("probeSession", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses no-store, manual-redirect, credentials-include fetch options", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse({ status: 200, ok: true }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await probeSession("/version");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/version",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        credentials: "include",
      })
    );
  });

  it("classifies opaqueredirect as expired", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ type: "opaqueredirect", status: 0, ok: false })) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("expired");
  });

  it("classifies a 3xx status as expired", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ status: 302, ok: false })) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("expired");
  });

  it("classifies a 200 HTML login page as expired", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse({ status: 200, ok: true, headers: { "content-type": "text/html; charset=utf-8" } })
    ) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("expired");
  });

  it("classifies a successful non-HTML response as ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse({ status: 200, ok: true, headers: { "content-type": "application/json" } })
    ) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("ok");
  });

  it("classifies a network error as offline, not expired", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("offline");
  });

  it("classifies a 5xx server error as offline, not expired", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ status: 503, ok: false })) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("offline");
  });

  it("classifies other non-ok statuses as offline", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ status: 404, ok: false })) as unknown as typeof fetch;

    await expect(probeSession("/version")).resolves.toBe("offline");
  });
});
