import type { MailDnsCheckReport, MxHostRow } from "./types";

const REPORT_CSS = `
body { font-family: system-ui, -apple-system, sans-serif; max-width: 52rem; margin: 1.5rem auto; padding: 0 1rem; font-size: 14px; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 1.35rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
h2 { font-size: 1.1rem; margin-top: 1.4rem; color: #333; }
h3 { font-size: 1rem; }
table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 0.5rem 0 1rem; }
th, td { border: 1px solid #ccc; padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; }
th { background: #f0f0f0; font-weight: 600; }
code { font-size: 0.85em; background: #f4f4f4; padding: 0.1em 0.25em; border-radius: 2px; }
pre { background: #f8f8f8; padding: 0.6rem 0.8rem; overflow-x: auto; font-size: 12px; border: 1px solid #e8e8e8; border-radius: 3px; white-space: pre-wrap; word-break: break-word; }
pre code { background: none; padding: 0; }
ul { padding-left: 1.4rem; }
li { margin: 0.2rem 0; }
hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
.status-ok { color: #16a34a; }
.status-warnings { color: #b45309; }
.status-errors { color: #dc2626; }
`.trim();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toUTCString().replace("GMT", "UTC");
}

function fcrdsLabel(row: MxHostRow): string {
  if (row.fcrds === "ok") return "✓";
  if (row.fcrds === "fail") return "✗";
  return "—";
}

function listSection(title: string, items: string[], icon: string): string {
  if (items.length === 0) return "";
  const lis = items.map((item) => `<li>${icon} ${escapeHtml(item)}</li>`).join("\n");
  return `<h2>${escapeHtml(title)}</h2>\n<ul>\n${lis}\n</ul>\n`;
}

function preBlock(lines: string[]): string {
  const text = lines.length > 0 ? lines.join("\n") : "(empty)";
  return `<pre><code>${escapeHtml(text)}</code></pre>`;
}

export function renderReportHtml(report: MailDnsCheckReport): string {
  const statusClass =
    report.status === "OK"
      ? "status-ok"
      : report.status === "WARNINGS"
        ? "status-warnings"
        : "status-errors";

  const nsRows = report.nameservers
    .map(
      (ns) =>
        `<tr><td>${escapeHtml(ns.hostname)}</td><td>${escapeHtml(ns.ip)}</td></tr>`
    )
    .join("\n");

  const consistencyRows = report.consistencyRows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td>${row.consistent ? "✓" : "✗"}</td><td><code>${escapeHtml(row.value)}</code></td></tr>`
    )
    .join("\n");

  const mxRows = report.mxHostRows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.host)}</td><td>${escapeHtml(row.aRecords)}</td><td>${escapeHtml(row.ptr)}</td><td>${fcrdsLabel(row)}</td></tr>`
    )
    .join("\n");

  const perNsSections = report.perNsRecords
    .map((ns) => {
      const dkimBlocks = Object.entries(ns.dkim)
        .map(([selector, records]) => {
          const combined = [...records.txt, ...records.cname];
          return `<p><strong>DKIM (${escapeHtml(selector)}):</strong></p>\n${preBlock(combined)}`;
        })
        .join("\n");

      const otherTxt =
        ns.otherApexTxt.length > 0
          ? `<p><strong>Other apex TXT (non-SPF):</strong></p>\n${preBlock(ns.otherApexTxt)}`
          : "";

      return `<h3>NS ${escapeHtml(ns.nsIp)}</h3>
<p><strong>SPF:</strong></p>
${preBlock(ns.spf)}
${otherTxt}
<p><strong>DMARC:</strong></p>
${preBlock(ns.dmarc)}
<p><strong>MX:</strong></p>
${preBlock(ns.mx)}
${dkimBlocks}`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DNS mail check: ${escapeHtml(report.domain)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <h1>DNS mail check report: ${escapeHtml(report.domain)}</h1>
  <p>Generated: ${escapeHtml(formatTimestamp(report.generatedAt))}</p>

  <h2>Summary</h2>
  <table>
    <tr><th></th><th></th></tr>
    <tr><td><strong>Status</strong></td><td class="${statusClass}"><strong>${escapeHtml(report.status)}</strong></td></tr>
    <tr><td>Errors</td><td>${report.issueCount}</td></tr>
    <tr><td>Warnings</td><td>${report.warningCount}</td></tr>
    <tr><td>Passed checks</td><td>${report.passCount}</td></tr>
  </table>

  ${listSection("Errors to fix", report.issues, "❌")}
  ${listSection("Warnings", report.warnings, "⚠️")}

  <h2>Authoritative nameservers</h2>
  <table>
    <tr><th>Nameserver</th><th>IP</th></tr>
    ${nsRows}
  </table>

  <h2>Record consistency across nameservers</h2>
  <p>Each row shows whether all authoritative NS return the same data.</p>
  <table>
    <tr><th>Record</th><th>Consistent</th><th>Value (from first NS)</th></tr>
    ${consistencyRows}
  </table>

  <h2>MX host resolution</h2>
  <table>
    <tr><th>MX host</th><th>A</th><th>PTR</th><th>FCrdNS</th></tr>
    ${mxRows}
  </table>

  <h2>Per-nameserver records</h2>
  ${perNsSections}

  ${listSection("Passed checks", report.passes, "✅")}

  <hr>
  <p><em>Generated by webdns Mail DNS check</em></p>
</body>
</html>`;
}

export function downloadReportHtml(report: MailDnsCheckReport, filename?: string): void {
  const html = renderReportHtml(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? `dns-mail-check-${report.domain}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
