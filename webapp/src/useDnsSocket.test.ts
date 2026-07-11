import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/preact";
import { useDnsSocket } from "./useDnsSocket";
import type { WsHeader } from "./types";

vi.mock("./authProbe", () => ({
  probeSession: vi.fn(),
}));
vi.mock("./authProxyStore", () => ({
  reportAuthExpired: vi.fn(),
  clearAuthExpired: vi.fn(),
}));

import { probeSession } from "./authProbe";
import { clearAuthExpired, reportAuthExpired } from "./authProxyStore";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  url: string;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = 3;
  }

  triggerOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  triggerClose(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code, reason: "" });
  }
}

const headers: WsHeader[] = [{ name: "apikey", value: "secret", enabled: true }];

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: typeof FakeWebSocket }).WebSocket = FakeWebSocket;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderConnectedSocket(identityProxy?: { enabled: boolean; probePath: string }) {
  const hook = renderHook(() =>
    useDnsSocket("ws://backend/ws", {
      connectionHeaders: headers,
      credentialsReady: true,
      identityProxy,
    })
  );

  await waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
  act(() => {
    FakeWebSocket.instances[0].triggerOpen();
  });

  return hook;
}

describe("useDnsSocket identity-proxy reconnect gating", () => {
  it("disabled identityProxy: never probes, reconnects on backoff as before", async () => {
    const hook = await renderConnectedSocket(undefined);

    act(() => {
      FakeWebSocket.instances[0].triggerClose(1006);
    });

    expect(probeSession).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(FakeWebSocket.instances.length).toBe(2);
    hook.unmount();
  });

  it("expired session: halts the reconnect loop and reports auth expired", async () => {
    vi.mocked(probeSession).mockResolvedValue("expired");
    const hook = await renderConnectedSocket({ enabled: true, probePath: "/version" });

    act(() => {
      FakeWebSocket.instances[0].triggerClose(1006);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(probeSession).toHaveBeenCalledWith("/version");
    expect(reportAuthExpired).toHaveBeenCalled();
    expect(hook.result.current.status).toBe("auth-expired");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(FakeWebSocket.instances.length).toBe(1);
    hook.unmount();
  });

  it("offline probe result: reconnect loop continues", async () => {
    vi.mocked(probeSession).mockResolvedValue("offline");
    const hook = await renderConnectedSocket({ enabled: true, probePath: "/version" });

    act(() => {
      FakeWebSocket.instances[0].triggerClose(1006);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(reportAuthExpired).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances.length).toBe(2);
    hook.unmount();
  });

  it("ok probe result: reconnect loop continues", async () => {
    vi.mocked(probeSession).mockResolvedValue("ok");
    const hook = await renderConnectedSocket({ enabled: true, probePath: "/version" });

    act(() => {
      FakeWebSocket.instances[0].triggerClose(1006);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(reportAuthExpired).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances.length).toBe(2);
    hook.unmount();
  });

  it("clears auth-expired state on successful (re)connect", async () => {
    const hook = await renderConnectedSocket({ enabled: true, probePath: "/version" });
    expect(clearAuthExpired).toHaveBeenCalled();
    hook.unmount();
  });
});
