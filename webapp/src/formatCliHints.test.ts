import { describe, expect, it } from "vitest";
import { formatCliHints, shellQuote, stripDnsPort } from "./formatCliHints";

describe("shellQuote", () => {
  it("leaves simple DNS names unquoted", () => {
    expect(shellQuote("nasoutez.eu")).toBe("nasoutez.eu");
    expect(shellQuote("_spf.mailersend.net")).toBe("_spf.mailersend.net");
  });

  it("quotes names with shell metacharacters", () => {
    expect(shellQuote("has space.example")).toBe("'has space.example'");
  });
});

describe("stripDnsPort", () => {
  it("removes an IPv4 port suffix", () => {
    expect(stripDnsPort("8.8.8.8:53")).toBe("8.8.8.8");
  });

  it("preserves bracketed IPv6 addresses with ports", () => {
    expect(stripDnsPort("[2001:4860:4860::8888]:53")).toBe("[2001:4860:4860::8888]");
  });
});

describe("formatCliHints", () => {
  it("formats dig and nslookup commands for a typical lookup", () => {
    expect(
      formatCliHints({
        recordType: "MX",
        domain: "nasoutez.eu",
        dnsServerResolved: "1.1.1.1",
      })
    ).toEqual({
      dig: "dig @1.1.1.1 MX +short nasoutez.eu",
      nslookup: "nslookup -type=MX nasoutez.eu 1.1.1.1",
    });
  });

  it("omits the resolver when none is provided", () => {
    expect(
      formatCliHints({
        recordType: "TXT",
        domain: "example.com",
      })
    ).toEqual({
      dig: "dig TXT +short example.com",
      nslookup: "nslookup -type=TXT example.com",
    });
  });

  it("brackets IPv6 resolvers for dig", () => {
    expect(
      formatCliHints({
        recordType: "A",
        domain: "example.com",
        dnsServerResolved: "2001:4860:4860::8888",
      })
    ).toEqual({
      dig: "dig @[2001:4860:4860::8888] A +short example.com",
      nslookup: "nslookup -type=A example.com 2001:4860:4860::8888",
    });
  });
});
