import { describe, expect, it } from "vitest";
import { parseAddressHint } from "./svcb";

describe("parseAddressHint", () => {
  it("splits a single ipv4hint address", () => {
    expect(parseAddressHint("ipv4hint=93.184.216.34")).toEqual({
      key: "ipv4hint",
      addresses: ["93.184.216.34"],
    });
  });

  it("splits multiple comma-separated ipv6hint addresses", () => {
    expect(parseAddressHint("ipv6hint=2001:db8::1,2001:db8::2")).toEqual({
      key: "ipv6hint",
      addresses: ["2001:db8::1", "2001:db8::2"],
    });
  });

  it("returns null for a non-hint param", () => {
    expect(parseAddressHint("alpn=h2,h3")).toBeNull();
  });

  it("returns null for a param with no value", () => {
    expect(parseAddressHint("ipv4hint=")).toBeNull();
  });

  it("returns null for a param with no '='", () => {
    expect(parseAddressHint("no-equals-sign")).toBeNull();
  });
});
