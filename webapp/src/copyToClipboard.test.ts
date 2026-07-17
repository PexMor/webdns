import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./copyToClipboard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("copyToClipboard", () => {
  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyToClipboard("dig MX +short example.com")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("dig MX +short example.com");
  });
});
