import { describe, expect, it } from "vitest";
import {
  aggregateFindings,
  checkMailPolicy,
  checkMxFcrds,
  checkNsConsistency,
  type MxHostSnapshot,
  type NsRecordSnapshot,
} from "./validation";

function snapshot(overrides: Partial<NsRecordSnapshot> = {}): NsRecordSnapshot {
  return {
    nsIp: "203.0.113.1",
    apexTxt: [],
    spfTxt: [],
    dmarcTxt: [],
    mxRecords: [],
    dkim: {},
    ...overrides,
  };
}

describe("checkNsConsistency", () => {
  it("flags SPF differences between nameservers", () => {
    const findings = checkNsConsistency(
      [
        { hostname: "ns1.example.com", ip: "203.0.113.1" },
        { hostname: "ns2.example.com", ip: "203.0.113.2" },
      ],
      [
        snapshot({ nsIp: "203.0.113.1", spfTxt: ["v=spf1 -all"] }),
        snapshot({ nsIp: "203.0.113.2", spfTxt: ["v=spf1 ~all"] }),
      ],
      []
    );
    expect(findings.some((f) => f.severity === "issue" && /SPF records differ/i.test(f.message))).toBe(
      true
    );
  });
});

describe("checkMailPolicy", () => {
  it("warns on SPF softfail", () => {
    const findings = checkMailPolicy(
      "example.com",
      [snapshot({ spfTxt: ["v=spf1 mx ~all"], dmarcTxt: ["v=DMARC1; p=reject"], mxRecords: ["10 mail.example.com"] })],
      []
    );
    expect(findings.some((f) => /softfail ~all/i.test(f.message))).toBe(true);
  });

  it("errors on multiple SPF records", () => {
    const findings = checkMailPolicy(
      "example.com",
      [
        snapshot({
          spfTxt: ["v=spf1 mx -all", "v=spf1 include:other -all"],
          dmarcTxt: ["v=DMARC1; p=reject"],
          mxRecords: ["10 mail.example.com"],
        }),
      ],
      []
    );
    expect(findings.some((f) => /Multiple SPF/i.test(f.message))).toBe(true);
  });

  it("warns on DMARC p=none", () => {
    const findings = checkMailPolicy(
      "example.com",
      [
        snapshot({
          spfTxt: ["v=spf1 -all"],
          dmarcTxt: ["v=DMARC1; p=none"],
          mxRecords: ["10 mail.example.com"],
        }),
      ],
      []
    );
    expect(findings.some((f) => /p=none/i.test(f.message))).toBe(true);
  });
});

describe("checkMxFcrds", () => {
  it("passes FCrdNS when PTR matches MX host", () => {
    const hosts: MxHostSnapshot[] = [
      {
        host: "mail.example.com",
        aRecords: ["198.51.100.1"],
        aaaaRecords: [],
        ptrByIp: { "198.51.100.1": ["mail.example.com."] },
      },
    ];
    const findings = checkMxFcrds(hosts);
    expect(findings.some((f) => /FCrdNS OK/i.test(f.message))).toBe(true);
  });

  it("warns on FCrdNS mismatch", () => {
    const hosts: MxHostSnapshot[] = [
      {
        host: "mail.example.com",
        aRecords: ["198.51.100.1"],
        aaaaRecords: [],
        ptrByIp: { "198.51.100.1": ["other.example.com."] },
      },
    ];
    const findings = checkMxFcrds(hosts);
    expect(findings.some((f) => /FCrdNS mismatch/i.test(f.message))).toBe(true);
  });
});

describe("aggregateFindings", () => {
  it("prefers ERRORS over WARNINGS", () => {
    const result = aggregateFindings([
      { severity: "warning", message: "warn" },
      { severity: "issue", message: "err" },
    ]);
    expect(result.status).toBe("ERRORS");
    expect(result.issues).toEqual(["err"]);
    expect(result.warnings).toEqual(["warn"]);
  });
});
