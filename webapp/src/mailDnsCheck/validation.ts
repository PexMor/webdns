import {
  hostnameMatch,
  normalizeRecordLines,
  recordsMatch,
} from "./normalize";
import type {
  CheckFinding,
  ConsistencyRow,
  MailDnsCheckReport,
  MxHostRow,
  NameserverInfo,
  PerNsDkimRecords,
  PerNsRecords,
  ReportStatus,
} from "./types";

export interface NsRecordSnapshot {
  nsIp: string;
  apexTxt: string[];
  spfTxt: string[];
  dmarcTxt: string[];
  mxRecords: string[];
  dkim: Record<string, PerNsDkimRecords>;
}

export interface MxHostSnapshot {
  host: string;
  aRecords: string[];
  aaaaRecords: string[];
  ptrByIp: Record<string, string[]>;
}

export function buildConsistencyRow(
  label: string,
  groups: string[][]
): ConsistencyRow {
  const consistent = recordsMatch(groups);
  const value = groups[0] ? normalizeRecordLines(groups[0]).join(" ") : "";
  return {
    label,
    consistent,
    value: value || "*(empty)*",
  };
}

export function checkNsConsistency(
  nameservers: NameserverInfo[],
  snapshots: NsRecordSnapshot[],
  selectors: string[]
): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const nsCount = nameservers.length;

  if (nsCount === 0) {
    findings.push({
      severity: "issue",
      message: "No authoritative nameserver IPs found",
    });
    return findings;
  }

  const spfGroups = snapshots.map((snap) => snap.spfTxt);
  if (recordsMatch(spfGroups)) {
    findings.push({
      severity: "pass",
      message: `SPF records are consistent across all ${nsCount} authoritative nameservers`,
    });
  } else {
    findings.push({
      severity: "issue",
      message:
        "SPF records differ between authoritative nameservers — DNS propagation or misconfiguration",
    });
  }

  const dmarcGroups = snapshots.map((snap) => snap.dmarcTxt);
  if (recordsMatch(dmarcGroups)) {
    findings.push({
      severity: "pass",
      message: `DMARC records are consistent across all ${nsCount} authoritative nameservers`,
    });
  } else {
    findings.push({
      severity: "issue",
      message: "DMARC records differ between authoritative nameservers",
    });
  }

  const mxGroups = snapshots.map((snap) => snap.mxRecords);
  if (recordsMatch(mxGroups)) {
    findings.push({
      severity: "pass",
      message: `MX records are consistent across all ${nsCount} authoritative nameservers`,
    });
  } else {
    findings.push({
      severity: "issue",
      message: "MX records differ between authoritative nameservers",
    });
  }

  for (const selector of selectors) {
    const txtGroups = snapshots.map((snap) => snap.dkim[selector]?.txt ?? []);
    const cnameGroups = snapshots.map((snap) => snap.dkim[selector]?.cname ?? []);
    if (recordsMatch(txtGroups) && recordsMatch(cnameGroups)) {
      findings.push({
        severity: "pass",
        message: `DKIM selector '${selector}' is consistent across all ${nsCount} authoritative nameservers`,
      });
    } else {
      findings.push({
        severity: "issue",
        message: `DKIM selector '${selector}' differs between authoritative nameservers`,
      });
    }
  }

  return findings;
}

export function checkMailPolicy(
  domain: string,
  snapshots: NsRecordSnapshot[],
  selectors: string[]
): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const first = snapshots[0];

  if (!first || first.spfTxt.length === 0) {
    findings.push({
      severity: "issue",
      message: `SPF record missing at apex TXT for ${domain}`,
    });
  } else {
    const spf = normalizeRecordLines(first.spfTxt)[0] ?? "";
    findings.push({ severity: "pass", message: `SPF record present: ${spf}` });

    if (/\s-all(?:\s|$)/i.test(spf)) {
      findings.push({ severity: "pass", message: "SPF uses strict -all qualifier" });
    } else if (/\s~all(?:\s|$)/i.test(spf)) {
      findings.push({
        severity: "warning",
        message: "SPF uses softfail ~all — consider -all for stricter policy",
      });
    } else if (/\s\?all(?:\s|$)/i.test(spf)) {
      findings.push({
        severity: "warning",
        message: "SPF uses neutral ?all — mail may be accepted without authentication",
      });
    } else {
      findings.push({
        severity: "warning",
        message: "SPF has no explicit terminal qualifier (-all / ~all / ?all)",
      });
    }

    const spfCount = first.spfTxt.filter((line) => /v=spf1/i.test(line)).length;
    if (spfCount > 1) {
      findings.push({
        severity: "issue",
        message: "Multiple SPF (v=spf1) records found — only one is allowed",
      });
    }
  }

  if (!first || first.dmarcTxt.length === 0) {
    findings.push({
      severity: "issue",
      message: `DMARC record missing at _dmarc.${domain}`,
    });
  } else {
    const dmarc = normalizeRecordLines(first.dmarcTxt)[0] ?? "";
    if (!/v=DMARC1/i.test(dmarc)) {
      findings.push({
        severity: "issue",
        message: `DMARC record at _dmarc.${domain} does not contain v=DMARC1`,
      });
    } else {
      findings.push({ severity: "pass", message: `DMARC record present: ${dmarc}` });
      if (/\bp=none\b/i.test(dmarc)) {
        findings.push({
          severity: "warning",
          message:
            "DMARC policy is p=none (monitor only) — move to quarantine/reject after validation",
        });
      } else if (/\bp=quarantine\b/i.test(dmarc)) {
        findings.push({ severity: "pass", message: "DMARC policy is p=quarantine" });
      } else if (/\bp=reject\b/i.test(dmarc)) {
        findings.push({ severity: "pass", message: "DMARC policy is p=reject (strictest)" });
      } else {
        findings.push({
          severity: "warning",
          message: "DMARC record has no explicit p= policy tag",
        });
      }
      if (!/\bru[aA]=/i.test(dmarc)) {
        findings.push({
          severity: "warning",
          message: "DMARC has no rua= aggregate report address",
        });
      }
    }
  }

  if (selectors.length === 0) {
    findings.push({
      severity: "warning",
      message: "No DKIM selectors configured — DKIM cannot be verified",
    });
  } else {
    for (const selector of selectors) {
      const dkim = first?.dkim[selector];
      const hasTxt = (dkim?.txt.length ?? 0) > 0;
      const hasCname = (dkim?.cname.length ?? 0) > 0;
      if (hasTxt || hasCname) {
        if (hasTxt) {
          findings.push({
            severity: "pass",
            message: `DKIM selector '${selector}' TXT present: ${normalizeRecordLines(dkim!.txt)[0]}`,
          });
        } else {
          findings.push({
            severity: "pass",
            message: `DKIM selector '${selector}' CNAME present: ${normalizeRecordLines(dkim!.cname)[0]}`,
          });
        }
      } else {
        findings.push({
          severity: "issue",
          message: `DKIM record missing for selector '${selector}' at ${selector}._domainkey.${domain}`,
        });
      }
    }
  }

  if (!first || first.mxRecords.length === 0) {
    findings.push({ severity: "issue", message: `MX records missing for ${domain}` });
  } else {
    findings.push({
      severity: "pass",
      message: `MX records present: ${normalizeRecordLines(first.mxRecords).join(" ")}`,
    });
  }

  return findings;
}

export function checkMxFcrds(mxHosts: MxHostSnapshot[]): CheckFinding[] {
  const findings: CheckFinding[] = [];

  for (const mx of mxHosts) {
    if (mx.aRecords.length === 0 && mx.aaaaRecords.length === 0) {
      findings.push({
        severity: "issue",
        message: `MX host ${mx.host} has no A record — mail delivery will fail`,
      });
      continue;
    }

    const ips = [...mx.aRecords, ...mx.aaaaRecords];
    for (const ip of ips) {
      const ptrRecords = mx.ptrByIp[ip] ?? [];
      if (ptrRecords.length === 0) {
        findings.push({
          severity: "issue",
          message: `MX host ${mx.host} (${ip}) has no PTR (reverse DNS) record`,
        });
        continue;
      }
      const ptr = normalizeRecordLines(ptrRecords)[0] ?? "";
      if (hostnameMatch(ptr, mx.host)) {
        findings.push({
          severity: "pass",
          message: `FCrdNS OK for ${mx.host} (${ip} → ${ptr})`,
        });
      } else {
        findings.push({
          severity: "warning",
          message: `FCrdNS mismatch for ${mx.host}: A=${mx.host}, PTR=${ptr} (expected matching hostname)`,
        });
      }
    }
  }

  return findings;
}

export function buildMxHostRows(mxHosts: MxHostSnapshot[]): MxHostRow[] {
  return mxHosts.map((mx) => {
    const aVal = [...mx.aRecords, ...mx.aaaaRecords].join(" ") || "*(missing)*";
    const firstIp = mx.aRecords[0] ?? mx.aaaaRecords[0] ?? "";
    let ptrVal = "—";
    let fcrds: MxHostRow["fcrds"] = "na";

    if (firstIp) {
      const ptrRecords = mx.ptrByIp[firstIp] ?? [];
      if (ptrRecords.length === 0) {
        ptrVal = "*(missing)*";
        fcrds = "fail";
      } else {
        ptrVal = normalizeRecordLines(ptrRecords)[0] ?? "";
        fcrds = hostnameMatch(ptrVal, mx.host) ? "ok" : "fail";
      }
    } else {
      fcrds = "fail";
    }

    return { host: mx.host, aRecords: aVal, ptr: ptrVal, fcrds };
  });
}

export function buildPerNsRecords(
  snapshots: NsRecordSnapshot[],
  selectors: string[]
): PerNsRecords[] {
  return snapshots.map((snap) => {
    const spfSet = new Set(snap.spfTxt.map((line) => line.toLowerCase()));
    const otherApexTxt = snap.apexTxt.filter((line) => !spfSet.has(line.toLowerCase()));
    return {
      nsIp: snap.nsIp,
      spf: snap.spfTxt,
      otherApexTxt,
      dmarc: snap.dmarcTxt,
      mx: snap.mxRecords,
      dkim: Object.fromEntries(
        selectors.map((selector) => [
          selector,
          snap.dkim[selector] ?? { txt: [], cname: [] },
        ])
      ),
    };
  });
}

export function aggregateFindings(findings: CheckFinding[]): {
  status: ReportStatus;
  issues: string[];
  warnings: string[];
  passes: string[];
} {
  const issues = findings.filter((f) => f.severity === "issue").map((f) => f.message);
  const warnings = findings.filter((f) => f.severity === "warning").map((f) => f.message);
  const passes = findings.filter((f) => f.severity === "pass").map((f) => f.message);
  let status: ReportStatus = "OK";
  if (issues.length > 0) status = "ERRORS";
  else if (warnings.length > 0) status = "WARNINGS";
  return { status, issues, warnings, passes };
}

export function buildConsistencyRows(
  snapshots: NsRecordSnapshot[],
  selectors: string[]
): ConsistencyRow[] {
  const rows: ConsistencyRow[] = [
    buildConsistencyRow("SPF", snapshots.map((snap) => snap.spfTxt)),
    buildConsistencyRow("DMARC", snapshots.map((snap) => snap.dmarcTxt)),
    buildConsistencyRow("MX", snapshots.map((snap) => snap.mxRecords)),
  ];
  for (const selector of selectors) {
    rows.push(
      buildConsistencyRow(
        `DKIM (${selector}) TXT`,
        snapshots.map((snap) => snap.dkim[selector]?.txt ?? [])
      )
    );
    rows.push(
      buildConsistencyRow(
        `DKIM (${selector}) CNAME`,
        snapshots.map((snap) => snap.dkim[selector]?.cname ?? [])
      )
    );
  }
  return rows;
}

export function assembleReport(
  domain: string,
  nameservers: NameserverInfo[],
  snapshots: NsRecordSnapshot[],
  mxHosts: MxHostSnapshot[],
  selectors: string[],
  findings: CheckFinding[]
): MailDnsCheckReport {
  const { status, issues, warnings, passes } = aggregateFindings(findings);
  return {
    domain,
    generatedAt: new Date().toISOString(),
    status,
    issueCount: issues.length,
    warningCount: warnings.length,
    passCount: passes.length,
    issues,
    warnings,
    passes,
    nameservers,
    consistencyRows: buildConsistencyRows(snapshots, selectors),
    mxHostRows: buildMxHostRows(mxHosts),
    perNsRecords: buildPerNsRecords(snapshots, selectors),
  };
}
