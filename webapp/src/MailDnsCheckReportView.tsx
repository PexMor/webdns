import { downloadReportHtml, type MailDnsCheckReport } from "./mailDnsCheck";

function formatReportTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function statusClass(status: MailDnsCheckReport["status"]): string {
  if (status === "OK") return "mail-dns-report__status--ok";
  if (status === "WARNINGS") return "mail-dns-report__status--warnings";
  return "mail-dns-report__status--errors";
}

function fcrdsLabel(fcrds: MailDnsCheckReport["mxHostRows"][number]["fcrds"]): string {
  if (fcrds === "ok") return "✓";
  if (fcrds === "fail") return "✗";
  return "—";
}

interface MailDnsCheckReportViewProps {
  report: MailDnsCheckReport;
  onBack: () => void;
}

export function MailDnsCheckReportView({ report, onBack }: MailDnsCheckReportViewProps) {
  return (
    <div class="mail-dns-report">
      <header class="mail-dns-report__header">
        <div>
          <h1>Mail DNS check: {report.domain}</h1>
          <p class="mail-dns-report__meta">Generated {formatReportTime(report.generatedAt)}</p>
        </div>
        <div class="mail-dns-report__actions">
          <button type="button" onClick={() => downloadReportHtml(report)}>
            Download HTML
          </button>
          <button type="button" class="mail-dns-report__back" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <section class="mail-dns-report__section">
        <h2>Summary</h2>
        <table class="mail-dns-report__table">
          <tbody>
            <tr>
              <th scope="row">Status</th>
              <td class={statusClass(report.status)}>
                <strong>{report.status}</strong>
              </td>
            </tr>
            <tr>
              <th scope="row">Errors</th>
              <td>{report.issueCount}</td>
            </tr>
            <tr>
              <th scope="row">Warnings</th>
              <td>{report.warningCount}</td>
            </tr>
            <tr>
              <th scope="row">Passed checks</th>
              <td>{report.passCount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {report.issues.length > 0 && (
        <section class="mail-dns-report__section">
          <h2>Errors to fix</h2>
          <ul class="mail-dns-report__findings mail-dns-report__findings--issues">
            {report.issues.map((item) => (
              <li key={item}>❌ {item}</li>
            ))}
          </ul>
        </section>
      )}

      {report.warnings.length > 0 && (
        <section class="mail-dns-report__section">
          <h2>Warnings</h2>
          <ul class="mail-dns-report__findings mail-dns-report__findings--warnings">
            {report.warnings.map((item) => (
              <li key={item}>⚠️ {item}</li>
            ))}
          </ul>
        </section>
      )}

      <section class="mail-dns-report__section">
        <h2>Authoritative nameservers</h2>
        <table class="mail-dns-report__table">
          <thead>
            <tr>
              <th>Nameserver</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {report.nameservers.map((ns) => (
              <tr key={ns.ip}>
                <td>{ns.hostname}</td>
                <td>{ns.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="mail-dns-report__section">
        <h2>Record consistency across nameservers</h2>
        <p class="menu-hint">Each row shows whether all authoritative NS return the same data.</p>
        <table class="mail-dns-report__table">
          <thead>
            <tr>
              <th>Record</th>
              <th>Consistent</th>
              <th>Value (from first NS)</th>
            </tr>
          </thead>
          <tbody>
            {report.consistencyRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.consistent ? "✓" : "✗"}</td>
                <td>
                  <code>{row.value}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="mail-dns-report__section">
        <h2>MX host resolution</h2>
        <table class="mail-dns-report__table">
          <thead>
            <tr>
              <th>MX host</th>
              <th>A</th>
              <th>PTR</th>
              <th>FCrdNS</th>
            </tr>
          </thead>
          <tbody>
            {report.mxHostRows.map((row) => (
              <tr key={row.host}>
                <td>{row.host}</td>
                <td>{row.aRecords}</td>
                <td>{row.ptr}</td>
                <td>{fcrdsLabel(row.fcrds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="mail-dns-report__section">
        <h2>Per-nameserver records</h2>
        {report.perNsRecords.map((ns) => (
          <article class="mail-dns-report__ns-block" key={ns.nsIp}>
            <h3>NS {ns.nsIp}</h3>
            <p>
              <strong>SPF:</strong>
            </p>
            <pre class="mail-dns-report__pre">{ns.spf.join("\n") || "(empty)"}</pre>
            {ns.otherApexTxt.length > 0 && (
              <>
                <p>
                  <strong>Other apex TXT (non-SPF):</strong>
                </p>
                <pre class="mail-dns-report__pre">{ns.otherApexTxt.join("\n")}</pre>
              </>
            )}
            <p>
              <strong>DMARC:</strong>
            </p>
            <pre class="mail-dns-report__pre">{ns.dmarc.join("\n") || "(empty)"}</pre>
            <p>
              <strong>MX:</strong>
            </p>
            <pre class="mail-dns-report__pre">{ns.mx.join("\n") || "(empty)"}</pre>
            {Object.entries(ns.dkim).map(([selector, records]) => (
              <div key={selector}>
                <p>
                  <strong>DKIM ({selector}):</strong>
                </p>
                <pre class="mail-dns-report__pre">
                  {[...records.txt, ...records.cname].join("\n") || "(empty)"}
                </pre>
              </div>
            ))}
          </article>
        ))}
      </section>

      {report.passes.length > 0 && (
        <section class="mail-dns-report__section">
          <h2>Passed checks</h2>
          <ul class="mail-dns-report__findings mail-dns-report__findings--passes">
            {report.passes.map((item) => (
              <li key={item}>✅ {item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
