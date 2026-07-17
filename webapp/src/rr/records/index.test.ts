import { describe, expect, it } from "vitest";
import "./index";
import { getRrTypeEntry } from "../registry";

function parseOrThrow(type: string, raw: string) {
  const entry = getRrTypeEntry(type);
  if (!entry) throw new Error(`no entry registered for ${type}`);
  const parsed = entry.parse(raw);
  if (!parsed) throw new Error(`failed to parse ${type}: ${raw}`);
  return parsed;
}

describe("address records", () => {
  it("parses A", () => {
    expect(parseOrThrow("A", "93.184.216.34")).toEqual({ address: "93.184.216.34" });
  });

  it("parses AAAA", () => {
    expect(parseOrThrow("AAAA", "2606:2800:220:1:248:1893:25c8:1946")).toEqual({
      address: "2606:2800:220:1:248:1893:25c8:1946",
    });
  });

  it("rejects an AAAA-shaped string for A", () => {
    expect(getRrTypeEntry("A")!.parse("2606:2800:220:1:248:1893:25c8:1946")).toBeNull();
  });
});

describe("single-target records", () => {
  it.each(["CNAME", "NS", "PTR", "ANAME"])("parses %s", (type) => {
    expect(parseOrThrow(type, "example.net.")).toEqual({ target: "example.net." });
  });

  it("rejects multi-token input", () => {
    expect(getRrTypeEntry("CNAME")!.parse("a b")).toBeNull();
  });
});

describe("MX", () => {
  it("parses preference and exchange", () => {
    expect(parseOrThrow("MX", "10 mail.example.com.")).toEqual({
      preference: "10",
      exchange: "mail.example.com.",
    });
  });

  it("rejects a non-numeric preference", () => {
    expect(getRrTypeEntry("MX")!.parse("abc mail.example.com.")).toBeNull();
  });
});

describe("TXT", () => {
  it("parses a single quoted string", () => {
    expect(parseOrThrow("TXT", '"v=spf1 include:_spf.example.com ~all"')).toEqual({
      strings: ["v=spf1 include:_spf.example.com ~all"],
    });
  });

  it("parses multiple adjacent quoted strings", () => {
    expect(parseOrThrow("TXT", '"part1" "part2"')).toEqual({ strings: ["part1", "part2"] });
  });

  it("keeps an unquoted multi-word string as a single value, spaces intact", () => {
    expect(parseOrThrow("TXT", "v=spf1 mx a:mail.example.com -all")).toEqual({
      strings: ["v=spf1 mx a:mail.example.com -all"],
    });
  });
});

describe("SOA", () => {
  it("parses all seven fields", () => {
    expect(
      parseOrThrow(
        "SOA",
        "ns1.example.com. hostmaster.example.com. (2025071001 7200 3600 1209600 300)"
      )
    ).toEqual({
      mname: "ns1.example.com.",
      rname: "hostmaster.example.com.",
      serial: "2025071001",
      refresh: "7200",
      retry: "3600",
      expire: "1209600",
      minimum: "300",
    });
  });

  it("rejects the wrong number of fields", () => {
    expect(getRrTypeEntry("SOA")!.parse("ns1.example.com. hostmaster.example.com.")).toBeNull();
  });
});

describe("SRV", () => {
  it("parses priority/weight/port/target", () => {
    expect(parseOrThrow("SRV", "10 5 5269 xmpp.example.com.")).toEqual({
      priority: "10",
      weight: "5",
      port: "5269",
      target: "xmpp.example.com.",
    });
  });
});

describe("HTTPS/SVCB", () => {
  it("parses HTTPS with quoted alpn and an ipv4hint param", () => {
    expect(parseOrThrow("HTTPS", '1 . alpn="h2,h3" ipv4hint=93.184.216.34')).toEqual({
      priority: "1",
      target: ".",
      params: ["alpn=h2,h3", "ipv4hint=93.184.216.34"],
    });
  });

  it("parses SVCB with a target and a single param", () => {
    expect(parseOrThrow("SVCB", "1 doh.example.com. alpn=h2 port=443")).toEqual({
      priority: "1",
      target: "doh.example.com.",
      params: ["alpn=h2", "port=443"],
    });
  });

  it("parses with no params", () => {
    expect(parseOrThrow("SVCB", "0 example.com.")).toEqual({
      priority: "0",
      target: "example.com.",
      params: [],
    });
  });
});

describe("DNSKEY/CDNSKEY/KEY", () => {
  it.each(["DNSKEY", "CDNSKEY", "KEY"])("parses %s", (type) => {
    expect(parseOrThrow(type, "256 3 13 MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A")).toEqual({
      flags: "256",
      protocol: "3",
      algorithm: "13",
      publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A",
    });
  });
});

describe("DS/CDS", () => {
  it.each(["DS", "CDS"])("parses %s", (type) => {
    expect(parseOrThrow(type, "2371 13 2 C988EC423E3880EB8DD8A46FE06CA230EE23F35B")).toEqual({
      keyTag: "2371",
      algorithm: "13",
      digestType: "2",
      digest: "C988EC423E3880EB8DD8A46FE06CA230EE23F35B",
    });
  });
});

describe("RRSIG/SIG", () => {
  it.each(["RRSIG", "SIG"])("parses %s", (type) => {
    expect(
      parseOrThrow(
        type,
        "A 13 2 3600 20250710000000 20250626000000 12345 example.com. oR8G3signature"
      )
    ).toEqual({
      typeCovered: "A",
      algorithm: "13",
      labels: "2",
      originalTtl: "3600",
      expiration: "20250710000000",
      inception: "20250626000000",
      keyTag: "12345",
      signerName: "example.com.",
      signature: "oR8G3signature",
    });
  });
});

describe("NSEC family", () => {
  it("parses NSEC", () => {
    expect(parseOrThrow("NSEC", "b.example.com. A RRSIG NSEC")).toEqual({
      nextDomainName: "b.example.com.",
      typeBitmaps: ["A", "RRSIG", "NSEC"],
    });
  });

  it("parses NSEC3", () => {
    expect(parseOrThrow("NSEC3", "1 0 0 - 9T0HASH A RRSIG")).toEqual({
      hashAlgorithm: "1",
      flags: "0",
      iterations: "0",
      salt: "-",
      nextHashedOwnerName: "9T0HASH",
      typeBitmaps: ["A", "RRSIG"],
    });
  });

  it("parses NSEC3PARAM", () => {
    expect(parseOrThrow("NSEC3PARAM", "1 0 0 -")).toEqual({
      hashAlgorithm: "1",
      flags: "0",
      iterations: "0",
      salt: "-",
    });
  });
});

describe("CSYNC", () => {
  it("parses serial/flags/typeBitmaps", () => {
    expect(parseOrThrow("CSYNC", "2025071001 3 A NS SOA")).toEqual({
      serial: "2025071001",
      flags: "3",
      typeBitmaps: ["A", "NS", "SOA"],
    });
  });
});

describe("CAA", () => {
  it("parses flag/tag/value", () => {
    expect(parseOrThrow("CAA", '0 issue "letsencrypt.org"')).toEqual({
      flag: "0",
      tag: "issue",
      value: "letsencrypt.org",
    });
  });
});

describe("TLSA", () => {
  it("parses usage/selector/matchingType/certData", () => {
    expect(
      parseOrThrow("TLSA", "3 1 1 2BBFFDE4C0C76A8D66B3305A1D0DB05B263A70FD")
    ).toEqual({
      usage: "3",
      selector: "1",
      matchingType: "1",
      certData: "2BBFFDE4C0C76A8D66B3305A1D0DB05B263A70FD",
    });
  });
});

describe("SSHFP", () => {
  it("parses algorithm/fpType/fingerprint", () => {
    expect(
      parseOrThrow(
        "SSHFP",
        "1 1 C4:8D:F2:1A:9B:3E:7F:2C:91:05:D8:44:6A:12:B7:9E:01:F3:88:4D"
      )
    ).toEqual({
      algorithm: "1",
      fpType: "1",
      fingerprint: "C4:8D:F2:1A:9B:3E:7F:2C:91:05:D8:44:6A:12:B7:9E:01:F3:88:4D",
    });
  });
});

describe("CERT", () => {
  it("parses certType/keyTag/algorithm/certificate", () => {
    expect(parseOrThrow("CERT", "1 1 3 MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A")).toEqual({
      certType: "1",
      keyTag: "1",
      algorithm: "3",
      certificate: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A",
    });
  });
});

describe("OPENPGPKEY", () => {
  it("parses a base64 blob", () => {
    expect(parseOrThrow("OPENPGPKEY", "mQENBGKxAAEQBASE64")).toEqual({
      data: "mQENBGKxAAEQBASE64",
    });
  });
});

describe("SMIMEA", () => {
  it("parses usage/selector/matchingType/certData", () => {
    expect(
      parseOrThrow("SMIMEA", "3 1 1 A1B2C3D4E5F6789012345678901234567890ABCD")
    ).toEqual({
      usage: "3",
      selector: "1",
      matchingType: "1",
      certData: "A1B2C3D4E5F6789012345678901234567890ABCD",
    });
  });
});

describe("HINFO", () => {
  it("parses cpu/os", () => {
    expect(parseOrThrow("HINFO", '"x86-64" "Linux"')).toEqual({ cpu: "x86-64", os: "Linux" });
  });
});

describe("NAPTR", () => {
  it("parses all six fields", () => {
    expect(
      parseOrThrow(
        "NAPTR",
        '100 10 "u" "E2U+sip" "!^.*$!sip:alice@example.com!" .'
      )
    ).toEqual({
      order: "100",
      preference: "10",
      flags: "u",
      service: "E2U+sip",
      regexp: "!^.*$!sip:alice@example.com!",
      replacement: ".",
    });
  });
});
