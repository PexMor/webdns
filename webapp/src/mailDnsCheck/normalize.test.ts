import { describe, expect, it } from "vitest";
import {
  extractSpfLines,
  hostnameMatch,
  normalizeRecordLines,
  recordsMatch,
  stripTrailingDot,
} from "./normalize";

describe("normalizeRecordLines", () => {
  it("trims, drops blanks, and sorts", () => {
    expect(normalizeRecordLines(["  b ", "", "a"])).toEqual(["a", "b"]);
  });
});

describe("recordsMatch", () => {
  it("returns true when normalized content matches", () => {
    expect(recordsMatch([[" b", "a "], ["a", "b"]])).toBe(true);
  });

  it("returns false when content differs", () => {
    expect(recordsMatch([["a"], ["b"]])).toBe(false);
  });
});

describe("extractSpfLines", () => {
  it("filters to v=spf1 lines only", () => {
    expect(
      extractSpfLines([
        "google-site-verification=abc",
        "v=spf1 mx -all",
        "v=SPF1 include:example.com -all",
      ])
    ).toEqual(["v=spf1 mx -all", "v=SPF1 include:example.com -all"]);
  });
});

describe("hostnameMatch", () => {
  it("matches hostnames ignoring case and trailing dot", () => {
    expect(hostnameMatch("Mail.Example.com.", "mail.example.com")).toBe(true);
    expect(hostnameMatch("mail.example.com", "other.example.com")).toBe(false);
  });
});

describe("stripTrailingDot", () => {
  it("removes a trailing dot", () => {
    expect(stripTrailingDot("ns1.example.com.")).toBe("ns1.example.com");
  });
});
