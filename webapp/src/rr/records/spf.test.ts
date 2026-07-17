import { describe, expect, it } from "vitest";
import { parseSpfTerm, parseSpfTerms } from "./spf";

describe("parseSpfTerms", () => {
  it("returns null for non-SPF text", () => {
    expect(parseSpfTerms('"just some text"')).toBeNull();
  });

  it("parses a realistic SPF record into terms", () => {
    const terms = parseSpfTerms(
      "v=spf1 mx a:mail.natrenink.eu ip4:46.36.35.234 ip6:2a02:25b0:aaaa:21ca:: -all"
    );
    expect(terms).not.toBeNull();
    expect(terms!.map((t) => t.raw)).toEqual([
      "v=spf1",
      "mx",
      "a:mail.natrenink.eu",
      "ip4:46.36.35.234",
      "ip6:2a02:25b0:aaaa:21ca::",
      "-all",
    ]);
  });
});

describe("parseSpfTerm", () => {
  it("does not treat the version term as actionable", () => {
    expect(parseSpfTerm("v=spf1")).toEqual(
      expect.objectContaining({ value: null, kind: null })
    );
  });

  it("does not treat a bare mx mechanism as actionable", () => {
    expect(parseSpfTerm("mx")).toEqual(expect.objectContaining({ value: null, kind: null }));
  });

  it("does not treat a bare a mechanism as actionable", () => {
    expect(parseSpfTerm("a")).toEqual(expect.objectContaining({ value: null, kind: null }));
  });

  it("parses a:hostname as a clickable hostname", () => {
    expect(parseSpfTerm("a:mail.natrenink.eu")).toEqual({
      prefix: "a:",
      value: "mail.natrenink.eu",
      kind: "hostname",
      suffix: "",
      raw: "a:mail.natrenink.eu",
    });
  });

  it("parses mx:hostname as a clickable hostname", () => {
    expect(parseSpfTerm("mx:example.com")).toEqual({
      prefix: "mx:",
      value: "example.com",
      kind: "hostname",
      suffix: "",
      raw: "mx:example.com",
    });
  });

  it("parses include:domain as a clickable TXT lookup target", () => {
    expect(parseSpfTerm("include:_spf.google.com")).toEqual({
      prefix: "include:",
      value: "_spf.google.com",
      kind: "txt",
      suffix: "",
      raw: "include:_spf.google.com",
    });
  });

  it("parses exists:hostname as a clickable hostname", () => {
    expect(parseSpfTerm("exists:example.com")).toEqual({
      prefix: "exists:",
      value: "example.com",
      kind: "hostname",
      suffix: "",
      raw: "exists:example.com",
    });
  });

  it("parses redirect=domain as a clickable TXT lookup target", () => {
    expect(parseSpfTerm("redirect=_spf.example.com")).toEqual({
      prefix: "redirect=",
      value: "_spf.example.com",
      kind: "txt",
      suffix: "",
      raw: "redirect=_spf.example.com",
    });
  });

  it("parses ip4:address as a clickable ip-address", () => {
    expect(parseSpfTerm("ip4:46.36.35.234")).toEqual({
      prefix: "ip4:",
      value: "46.36.35.234",
      kind: "ip-address",
      suffix: "",
      raw: "ip4:46.36.35.234",
    });
  });

  it("parses ip6:address as a clickable ip-address, preserving internal colons", () => {
    expect(parseSpfTerm("ip6:2a02:25b0:aaaa:21ca::")).toEqual({
      prefix: "ip6:",
      value: "2a02:25b0:aaaa:21ca::",
      kind: "ip-address",
      suffix: "",
      raw: "ip6:2a02:25b0:aaaa:21ca::",
    });
  });

  it("strips a CIDR suffix from the clickable value but keeps it in the rendered suffix", () => {
    expect(parseSpfTerm("ip4:46.36.35.0/24")).toEqual({
      prefix: "ip4:",
      value: "46.36.35.0",
      kind: "ip-address",
      suffix: "/24",
      raw: "ip4:46.36.35.0/24",
    });
  });

  it("strips a CIDR suffix from a:hostname", () => {
    expect(parseSpfTerm("a:mail.example.com/24")).toEqual({
      prefix: "a:",
      value: "mail.example.com",
      kind: "hostname",
      suffix: "/24",
      raw: "a:mail.example.com/24",
    });
  });

  it("preserves a leading qualifier in the prefix", () => {
    expect(parseSpfTerm("-include:example.com")).toEqual({
      prefix: "-include:",
      value: "example.com",
      kind: "txt",
      suffix: "",
      raw: "-include:example.com",
    });
  });

  it("does not treat the all mechanism as actionable, with or without a qualifier", () => {
    for (const term of ["all", "-all", "~all", "+all", "?all"]) {
      expect(parseSpfTerm(term)).toEqual(expect.objectContaining({ value: null, kind: null }));
    }
  });

  it("does not treat a macro-letter domain-spec as actionable", () => {
    expect(parseSpfTerm("exists:%{i}.example.com")).toEqual(
      expect.objectContaining({ value: null, kind: null })
    );
  });

  it("does not treat an unrecognized mechanism as actionable", () => {
    expect(parseSpfTerm("ptr:example.com")).toEqual(
      expect.objectContaining({ value: null, kind: null })
    );
  });
});
