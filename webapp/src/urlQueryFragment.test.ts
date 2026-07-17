import { describe, expect, it } from "vitest";
import { decodeQueryFragment, encodeQueryFragment } from "./urlQueryFragment";

describe("encodeQueryFragment", () => {
  it("encodes domain and record types", () => {
    expect(encodeQueryFragment({ domain: "example.com", recordTypes: ["A", "AAAA"] })).toBe(
      "domain=example.com&types=A%2CAAAA"
    );
  });

  it("omits optional fields when absent", () => {
    const fragment = encodeQueryFragment({ domain: "example.com", recordTypes: ["MX"] });
    expect(fragment).not.toContain("server=");
    expect(fragment).not.toContain("enum=");
    expect(fragment).not.toContain("service=");
    expect(fragment).not.toContain("port=");
  });

  it("includes the DNS server address when set", () => {
    const fragment = encodeQueryFragment({
      domain: "example.com",
      recordTypes: ["A"],
      dnsServerAddress: "1.1.1.1",
    });
    expect(new URLSearchParams(fragment).get("server")).toBe("1.1.1.1");
  });

  it("includes enum mode only when true", () => {
    expect(encodeQueryFragment({ domain: "1-800-555-1234", recordTypes: ["NAPTR"], enumMode: true })).toContain(
      "enum=1"
    );
    expect(encodeQueryFragment({ domain: "example.com", recordTypes: ["NAPTR"], enumMode: false })).not.toContain(
      "enum="
    );
  });

  it("includes SRV fields when set", () => {
    const fragment = encodeQueryFragment({
      domain: "example.com",
      recordTypes: ["SRV"],
      srvFields: { service: "sip", protocol: "tcp" },
    });
    const params = new URLSearchParams(fragment);
    expect(params.get("service")).toBe("sip");
    expect(params.get("protocol")).toBe("tcp");
  });

  it("includes TLSA fields when set", () => {
    const fragment = encodeQueryFragment({
      domain: "example.com",
      recordTypes: ["TLSA"],
      tlsaFields: { port: "443", transport: "tcp" },
    });
    const params = new URLSearchParams(fragment);
    expect(params.get("port")).toBe("443");
    expect(params.get("transport")).toBe("tcp");
  });
});

describe("decodeQueryFragment", () => {
  it("round-trips a simple query", () => {
    const fragment = encodeQueryFragment({ domain: "example.com", recordTypes: ["A", "AAAA"] });
    expect(decodeQueryFragment(fragment)).toEqual({
      domain: "example.com",
      recordTypes: ["A", "AAAA"],
      dnsServerAddress: undefined,
      enumMode: false,
      srvFields: undefined,
      tlsaFields: undefined,
    });
  });

  it("accepts a fragment with a leading #", () => {
    expect(decodeQueryFragment("#domain=example.com&types=MX")).toEqual(
      expect.objectContaining({ domain: "example.com", recordTypes: ["MX"] })
    );
  });

  it("returns null for an empty fragment", () => {
    expect(decodeQueryFragment("")).toBeNull();
    expect(decodeQueryFragment("#")).toBeNull();
  });

  it("returns null when domain is missing", () => {
    expect(decodeQueryFragment("types=A")).toBeNull();
  });

  it("returns null when types is missing", () => {
    expect(decodeQueryFragment("domain=example.com")).toBeNull();
  });

  it("drops unknown record type codes but keeps valid ones", () => {
    expect(decodeQueryFragment("domain=example.com&types=A,NOTAREALTYPE,AAAA")).toEqual(
      expect.objectContaining({ recordTypes: ["A", "AAAA"] })
    );
  });

  it("returns null when every record type code is invalid", () => {
    expect(decodeQueryFragment("domain=example.com&types=NOTAREALTYPE")).toBeNull();
  });

  it("normalizes record type case", () => {
    expect(decodeQueryFragment("domain=example.com&types=a,aaaa")).toEqual(
      expect.objectContaining({ recordTypes: ["A", "AAAA"] })
    );
  });

  it("round-trips DNS server, enum mode, and SRV/TLSA fields", () => {
    const fragment = encodeQueryFragment({
      domain: "example.com",
      recordTypes: ["SRV"],
      dnsServerAddress: "1.1.1.1",
      enumMode: true,
      srvFields: { service: "sip", protocol: "tcp" },
      tlsaFields: { port: "443", transport: "tcp" },
    });
    expect(decodeQueryFragment(fragment)).toEqual({
      domain: "example.com",
      recordTypes: ["SRV"],
      dnsServerAddress: "1.1.1.1",
      enumMode: true,
      srvFields: { service: "sip", protocol: "tcp" },
      tlsaFields: { port: "443", transport: "tcp" },
    });
  });
});
