// @vitest-environment node
//
// This file needs a real SubtleCrypto for the OPENPGPKEY/SMIMEA tests. jsdom's
// `crypto` implementation doesn't include `.subtle`, and importing `node:crypto`
// to patch it in gets externalized to a stub by Vite's browser-mode transform.
// Nothing here touches the DOM, so run under the plain `node` environment
// instead, where `globalThis.crypto.subtle` is natively available.
import { describe, expect, it } from "vitest";
import {
  EMAIL_HASH_UNAVAILABLE_ERROR,
  engagedConvention,
  ipv4ToInAddrArpa,
  ipv6ToIp6Arpa,
  isArpaReverseName,
  isEmailAddress,
  isIpAddress,
  openpgpkeyOwnerName,
  parseUrlForTlsa,
  phoneToE164Arpa,
  smimeaOwnerName,
  srvOwnerName,
  tlsaOwnerName,
  transformQueryInput,
} from "./queryTransforms";

describe("isIpAddress", () => {
  it("accepts a plain IPv4 address", () => {
    expect(isIpAddress("8.8.4.4")).toBe(true);
  });

  it("accepts a plain IPv6 address", () => {
    expect(isIpAddress("2001:db8::567:89ab")).toBe(true);
  });

  it("rejects an ordinary hostname", () => {
    expect(isIpAddress("example.com")).toBe(false);
  });

  it("rejects an out-of-range IPv4 octet", () => {
    expect(isIpAddress("8.8.4.999")).toBe(false);
  });
});

describe("ipv4ToInAddrArpa", () => {
  it("reverses octets and appends in-addr.arpa", () => {
    expect(ipv4ToInAddrArpa("8.8.4.4")).toBe("4.4.8.8.in-addr.arpa");
  });

  it("returns null for an invalid address", () => {
    expect(ipv4ToInAddrArpa("not-an-ip")).toBeNull();
  });
});

describe("ipv6ToIp6Arpa", () => {
  it("matches the RFC 3596 worked example", () => {
    expect(ipv6ToIp6Arpa("4321:0:1:2:3:4:567:89ab")).toBe(
      "b.a.9.8.7.6.5.0.4.0.0.0.3.0.0.0.2.0.0.0.1.0.0.0.0.0.0.0.1.2.3.4.ip6.arpa"
    );
  });

  it("expands :: shorthand", () => {
    expect(ipv6ToIp6Arpa("2001:db8::567:89ab")).toBe(
      "b.a.9.8.7.6.5.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa"
    );
  });

  it("expands the unspecified address ::", () => {
    expect(ipv6ToIp6Arpa("::")).toBe(
      "0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa"
    );
  });

  it("returns null for more than one ::", () => {
    expect(ipv6ToIp6Arpa("1::2::3")).toBeNull();
  });

  it("returns null for an invalid address", () => {
    expect(ipv6ToIp6Arpa("not-an-ip")).toBeNull();
  });
});

describe("isArpaReverseName", () => {
  it("detects an in-addr.arpa name", () => {
    expect(isArpaReverseName("4.4.8.8.in-addr.arpa")).toBe(true);
  });

  it("detects an ip6.arpa name case-insensitively with a trailing dot", () => {
    expect(isArpaReverseName("EXAMPLE.IP6.ARPA.")).toBe(true);
  });

  it("rejects an ordinary hostname", () => {
    expect(isArpaReverseName("example.com")).toBe(false);
  });
});

describe("phoneToE164Arpa", () => {
  it("matches the worked example from the proposal", () => {
    expect(phoneToE164Arpa("1-800-555-1234")).toBe("4.3.2.1.5.5.5.0.0.8.1.e164.arpa");
  });

  it("strips a leading + and formatting characters", () => {
    expect(phoneToE164Arpa("+1 (800) 555-1234")).toBe("4.3.2.1.5.5.5.0.0.8.1.e164.arpa");
  });

  it("returns null when there are no digits", () => {
    expect(phoneToE164Arpa("not a phone number")).toBeNull();
  });
});

describe("srvOwnerName", () => {
  it("constructs the underscored owner name", () => {
    expect(srvOwnerName("sip", "tcp", "example.com")).toBe("_sip._tcp.example.com");
  });

  it("accepts a leading underscore on the inputs", () => {
    expect(srvOwnerName("_sip", "_tcp", "example.com")).toBe("_sip._tcp.example.com");
  });

  it("returns null for an invalid label", () => {
    expect(srvOwnerName("sip!", "tcp", "example.com")).toBeNull();
  });
});

describe("tlsaOwnerName", () => {
  it("constructs the underscored owner name", () => {
    expect(tlsaOwnerName("443", "tcp", "example.com")).toBe("_443._tcp.example.com");
  });

  it("returns null for an out-of-range port", () => {
    expect(tlsaOwnerName("70000", "tcp", "example.com")).toBeNull();
  });

  it("returns null for a non-numeric port", () => {
    expect(tlsaOwnerName("abc", "tcp", "example.com")).toBeNull();
  });
});

describe("parseUrlForTlsa", () => {
  it("derives port 443 and host from an https URL with no explicit port", () => {
    expect(parseUrlForTlsa("https://www.example.com")).toEqual({ port: 443, host: "www.example.com" });
  });

  it("derives port 80 for http", () => {
    expect(parseUrlForTlsa("http://example.com")).toEqual({ port: 80, host: "example.com" });
  });

  it("honors an explicit port in the URL", () => {
    expect(parseUrlForTlsa("https://example.com:8443")).toEqual({ port: 8443, host: "example.com" });
  });

  it("returns null for a bare domain (not a URL)", () => {
    expect(parseUrlForTlsa("example.com")).toBeNull();
  });
});

describe("isEmailAddress", () => {
  it("accepts a simple email address", () => {
    expect(isEmailAddress("alice@example.com")).toBe(true);
  });

  it("rejects a plain hostname", () => {
    expect(isEmailAddress("example.com")).toBe(false);
  });

  it("rejects input with more than one @", () => {
    expect(isEmailAddress("a@b@example.com")).toBe(false);
  });
});

describe("openpgpkeyOwnerName / smimeaOwnerName", () => {
  it("matches the RFC 7929 worked example for OPENPGPKEY", async () => {
    const result = await openpgpkeyOwnerName("hugh@example.com");
    expect(result).toEqual({
      queryName: "c93f1e400f26708f98cb19d936620da35eec8f72e57f9eec01c1afd6._openpgpkey.example.com",
    });
  });

  it("matches the RFC 8162 worked example for SMIMEA", async () => {
    const result = await smimeaOwnerName("hugh@example.com");
    expect(result).toEqual({
      queryName: "c93f1e400f26708f98cb19d936620da35eec8f72e57f9eec01c1afd6._smimecert.example.com",
    });
  });

  it("surfaces a clear error when crypto.subtle is unavailable", async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true });
    try {
      const result = await openpgpkeyOwnerName("alice@example.com");
      expect(result).toEqual({ error: EMAIL_HASH_UNAVAILABLE_ERROR });
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });
});

describe("engagedConvention", () => {
  const base = {
    domain: "example.com",
    enumMode: false,
    srvFields: { service: "", protocol: "" },
    tlsaFields: { port: "", transport: "" },
  };

  it("reports no convention engaged by default", () => {
    expect(engagedConvention({ ...base, recordTypes: ["A", "MX"] })).toBeNull();
  });

  it("engages reverse-dns when PTR is selected with an IP-shaped domain", () => {
    expect(engagedConvention({ ...base, recordTypes: ["PTR"], domain: "8.8.4.4" })).toBe("reverse-dns");
  });

  it("does not engage PTR for an ordinary hostname", () => {
    expect(engagedConvention({ ...base, recordTypes: ["PTR"] })).toBeNull();
  });

  it("engages enum only when NAPTR is selected and enumMode is on", () => {
    expect(engagedConvention({ ...base, recordTypes: ["NAPTR"], enumMode: true })).toBe("enum");
    expect(engagedConvention({ ...base, recordTypes: ["NAPTR"], enumMode: false })).toBeNull();
  });

  it("engages srv only when service/protocol fields are non-empty", () => {
    expect(
      engagedConvention({ ...base, recordTypes: ["SRV"], srvFields: { service: "sip", protocol: "" } })
    ).toBe("srv");
    expect(engagedConvention({ ...base, recordTypes: ["SRV"] })).toBeNull();
  });

  it("engages tlsa from fields or a parseable URL", () => {
    expect(
      engagedConvention({ ...base, recordTypes: ["TLSA"], tlsaFields: { port: "443", transport: "" } })
    ).toBe("tlsa");
    expect(engagedConvention({ ...base, recordTypes: ["TLSA"], domain: "https://example.com" })).toBe("tlsa");
    expect(engagedConvention({ ...base, recordTypes: ["TLSA"] })).toBeNull();
  });

  it("engages openpgpkey/smimea on email-shaped input", () => {
    expect(engagedConvention({ ...base, recordTypes: ["OPENPGPKEY"], domain: "alice@example.com" })).toBe(
      "openpgpkey"
    );
    expect(engagedConvention({ ...base, recordTypes: ["SMIMEA"], domain: "alice@example.com" })).toBe("smimea");
  });
});

describe("transformQueryInput", () => {
  it("passes through literally when no convention is engaged", async () => {
    await expect(transformQueryInput({ recordTypes: ["A", "MX"], domain: "example.com" })).resolves.toEqual({
      queryName: "example.com",
    });
  });

  it("resolves a PTR reverse lookup", async () => {
    await expect(transformQueryInput({ recordTypes: ["PTR"], domain: "8.8.4.4" })).resolves.toEqual({
      queryName: "4.4.8.8.in-addr.arpa",
    });
  });

  it("passes through a literal PTR hostname query", async () => {
    await expect(transformQueryInput({ recordTypes: ["PTR"], domain: "example.com" })).resolves.toEqual({
      queryName: "example.com",
    });
  });

  it("resolves an ENUM lookup only when enumMode is enabled", async () => {
    await expect(
      transformQueryInput({ recordTypes: ["NAPTR"], domain: "1-800-555-1234", enumMode: true })
    ).resolves.toEqual({ queryName: "4.3.2.1.5.5.5.0.0.8.1.e164.arpa" });

    await expect(
      transformQueryInput({ recordTypes: ["NAPTR"], domain: "example.com", enumMode: false })
    ).resolves.toEqual({ queryName: "example.com" });
  });

  it("rejects an ENUM phone number with no digits", async () => {
    await expect(
      transformQueryInput({ recordTypes: ["NAPTR"], domain: "no-digits-here", enumMode: true })
    ).resolves.toEqual({ error: expect.any(String) });
  });

  it("resolves an SRV lookup from service/protocol fields", async () => {
    await expect(
      transformQueryInput({
        recordTypes: ["SRV"],
        domain: "example.com",
        srvFields: { service: "sip", protocol: "tcp" },
      })
    ).resolves.toEqual({ queryName: "_sip._tcp.example.com" });
  });

  it("errors when only one of service/protocol is supplied", async () => {
    await expect(
      transformQueryInput({
        recordTypes: ["SRV"],
        domain: "example.com",
        srvFields: { service: "sip", protocol: "" },
      })
    ).resolves.toEqual({ error: expect.any(String) });
  });

  it("resolves a TLSA lookup from port/transport fields", async () => {
    await expect(
      transformQueryInput({
        recordTypes: ["TLSA"],
        domain: "example.com",
        tlsaFields: { port: "443", transport: "tcp" },
      })
    ).resolves.toEqual({ queryName: "_443._tcp.example.com" });
  });

  it("resolves a TLSA lookup from a pasted URL", async () => {
    await expect(
      transformQueryInput({ recordTypes: ["TLSA"], domain: "https://www.example.com" })
    ).resolves.toEqual({ queryName: "_443._tcp.www.example.com" });
  });

  it("resolves OPENPGPKEY from an email address", async () => {
    await expect(
      transformQueryInput({ recordTypes: ["OPENPGPKEY"], domain: "hugh@example.com" })
    ).resolves.toEqual({
      queryName: "c93f1e400f26708f98cb19d936620da35eec8f72e57f9eec01c1afd6._openpgpkey.example.com",
    });
  });
});
