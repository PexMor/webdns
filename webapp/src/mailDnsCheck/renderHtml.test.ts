import { describe, expect, it } from "vitest";
import { renderReportHtml } from "./renderHtml";
import type { MailDnsCheckReport } from "./types";

const sampleReport: MailDnsCheckReport = {
  domain: "example.com",
  generatedAt: "2026-07-17T12:00:00.000Z",
  status: "WARNINGS",
  issueCount: 0,
  warningCount: 1,
  passCount: 1,
  issues: [],
  warnings: ["SPF uses softfail ~all"],
  passes: ["MX records present"],
  nameservers: [{ hostname: "ns1.example.com", ip: "203.0.113.1" }],
  consistencyRows: [{ label: "SPF", consistent: true, value: "v=spf1 -all" }],
  mxHostRows: [
    { host: "mail.example.com", aRecords: "198.51.100.1", ptr: "mail.example.com", fcrds: "ok" },
  ],
  perNsRecords: [
    {
      nsIp: "203.0.113.1",
      spf: ["v=spf1 -all"],
      otherApexTxt: [],
      dmarc: ["v=DMARC1; p=none"],
      mx: ["10 mail.example.com"],
      dkim: { default: { txt: [], cname: [] } },
    },
  ],
};

describe("renderReportHtml", () => {
  it("produces standalone HTML with embedded styles", () => {
    const html = renderReportHtml(sampleReport);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<style>");
    expect(html).toContain("DNS mail check report: example.com");
    expect(html).toContain("WARNINGS");
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });
});
