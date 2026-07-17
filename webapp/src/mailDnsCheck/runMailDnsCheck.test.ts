import { describe, expect, it, vi } from "vitest";
import { runMailDnsCheck } from "./runMailDnsCheck";
import type { DnsQueryResponse } from "../types";
import type { MailDnsQueryFn } from "./types";

function response(
  domain: string,
  records: Record<string, string[]>
): DnsQueryResponse {
  return {
    domain,
    results: Object.entries(records).map(([record_type, lines]) => ({
      record_type,
      records: lines,
    })),
  };
}

describe("runMailDnsCheck", () => {
  it("builds a report for consistent authoritative data", async () => {
    const calls: Array<{ domain: string; recordTypes: string[]; dnsServer?: string }> = [];

    const query: MailDnsQueryFn = vi.fn(async (req) => {
      calls.push(req);

      if (req.recordTypes.includes("NS") && req.domain === "example.com") {
        return response("example.com", { NS: ["ns1.example.com."] });
      }
      if (req.domain === "ns1.example.com" && req.recordTypes.includes("A")) {
        return response("ns1.example.com", { A: ["203.0.113.1"] });
      }
      if (req.dnsServer === "203.0.113.1" && req.domain === "example.com" && req.recordTypes.includes("TXT")) {
        return response("example.com", { TXT: ["v=spf1 mx -all", "google-site-verification=x"] });
      }
      if (req.dnsServer === "203.0.113.1" && req.domain === "_dmarc.example.com") {
        return response("_dmarc.example.com", { TXT: ["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"] });
      }
      if (req.dnsServer === "203.0.113.1" && req.domain === "example.com" && req.recordTypes.includes("MX")) {
        return response("example.com", { MX: ["10 mail.example.com."] });
      }
      if (req.dnsServer === "203.0.113.1" && req.domain === "default._domainkey.example.com") {
        if (req.recordTypes.includes("TXT")) {
          return response("default._domainkey.example.com", { TXT: ["v=DKIM1; k=rsa; p=abc"] });
        }
        return response("default._domainkey.example.com", { CNAME: [] });
      }
      if (req.domain === "mail.example.com" && req.recordTypes.includes("A")) {
        return response("mail.example.com", { A: ["198.51.100.1"] });
      }
      if (req.domain === "mail.example.com" && req.recordTypes.includes("AAAA")) {
        return response("mail.example.com", { AAAA: [] });
      }
      if (req.recordTypes.includes("PTR")) {
        return response(req.domain, { PTR: ["mail.example.com."] });
      }

      return response(req.domain, {});
    });

    const report = await runMailDnsCheck(
      { domain: "example.com", dkimSelectors: ["default"] },
      query,
      { defaultResolver: "1.1.1.1" }
    );

    expect(report.domain).toBe("example.com");
    expect(report.nameservers).toEqual([{ hostname: "ns1.example.com", ip: "203.0.113.1" }]);
    expect(report.consistencyRows.find((row) => row.label === "SPF")?.consistent).toBe(true);
    expect(report.passes.some((msg) => /FCrdNS OK/i.test(msg))).toBe(true);
    expect(calls.some((call) => call.dnsServer === "203.0.113.1")).toBe(true);
  });
});
