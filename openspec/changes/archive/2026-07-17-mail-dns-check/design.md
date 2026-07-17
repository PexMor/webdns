## Context

`tmp/01_dns_check.sh` implements a complete mail-DNS audit: discover authoritative NS, query each NS IP directly for SPF/DMARC/DKIM/MX, compare answers for split-brain, chase MX hosts for A/PTR/FCrdNS, apply policy heuristics, and emit Markdown + optional pandoc HTML.

The web client already talks to the resolver backend over WebSocket. Each request accepts `{ domain, record_types, dns_server? }` and returns per-type results. The Settings panel's selected DNS server is the default upstream; per-request `dns_server` overrides it — exactly what the script achieves with `dig … @<ns_ip>`.

The script's report is a structured document (summary, issue lists, tables, per-NS detail). The webapp should render the same information in a dedicated full-screen view and serialize it to standalone HTML without pandoc (generate HTML directly in TypeScript).

`MenuPanel` today covers settings, history, quick lookups, and about. Mail DNS check is a separate workflow (multi-query batch job + report), not a single lookup — it warrants its own panel and a top-level full-screen report state in `app.tsx`.

## Goals / Non-Goals

**Goals:**
- Parity with `01_dns_check.sh` / `01_dns_check.md` for checks, sections, and severity classification (issue vs warning vs pass).
- Menu-launched UX: domain + DKIM selectors input → Run → progress → full-screen report.
- In-app report and downloadable self-contained HTML share one report model / renderer.
- Use only the existing backend API (sequential or limited-concurrency WebSocket queries with per-request `dns_server`).
- Work with the user's configured default resolver for NS discovery and MX host resolution (same as script's `@1.1.1.1` for non-authoritative steps); use each authoritative NS IP for consistency queries.

**Non-Goals:**
- Auto-discovering DKIM selectors (document that users must supply them from `DKIM-Signature` headers).
- Backend batch endpoint or server-side report generation.
- Persisting reports to IndexedDB / history (export-only persistence via downloaded HTML).
- Demo-mode support in v1 (mail check requires a live backend; show a clear message if not connected).
- Interactive follow-up clicks inside the report (plain report; user can return to main lookup separately).
- PDF export.

## Decisions

**Port check logic to TypeScript in a dedicated `mailDnsCheck/` module, mirroring the script's functions — not a WASM/shell wrapper.**
The script's logic is pure data transformation over DNS answers. A TS port is testable, runs in-browser, and needs no new infrastructure. Structure: `runMailDnsCheck({ domain, dkimSelectors, query })` where `query` is an injected async function wrapping `useDnsSocket.query`.

**Two-phase query orchestration with a progress callback.**
1. **Discovery** (via default resolver): `NS` for domain → `A` for each NS hostname → collect NS IPs.
2. **Per-NS consistency** (via each NS IP as `dns_server`): apex `TXT`, `_dmarc.<domain>` `TXT`, `MX`, and per-selector DKIM `TXT` + `CNAME`.
3. **MX host checks** (via default resolver): for each unique MX exchange, `A`, `AAAA`, then `PTR` for each returned IP.

Expose `{ phase, message, completed, total }` for a simple progress indicator during the run. Cap concurrent in-flight WebSocket requests (e.g. 3–4) to avoid flooding the backend while still finishing faster than strictly sequential.

**SPF extraction reuses `parseSpfTerms` / `v=spf1` filtering from `rr/records/spf.ts`.**
Apex TXT may include non-SPF records (e.g. `google-site-verification`); only lines containing `v=spf1` (case-insensitive) participate in SPF checks and consistency, matching the script's `filter_spf_records`.

**Normalized comparison: sort lines, trim, lowercase hostnames for equality — same as script's `normalize_file` + `records_match`.**
Store raw answers per NS for the per-NS detail section; use normalized form only for consistency ✓/✗.

**Report model is a plain JSON-serializable `MailDnsCheckReport` object; HTML is rendered from it.**
Sections: `summary`, `issues`, `warnings`, `passes`, `nameservers`, `consistencyRows`, `mxHostRows`, `perNsRecords`. Both the in-app Preact view and `renderReportHtml(report)` consume this model. CSS is a constant string inlined in the HTML `<style>` block (based on the script's `write_report_css`).

**Full-screen report via `app.tsx` view state (`mailDnsReport: MailDnsCheckReport | null`), not a URL route.**
Keeps the SPA simple (no router dependency). When a report is active, the main lookup UI is hidden and a report chrome is shown (title, domain, timestamp, Back, Download HTML). Closing returns to the previous view. This matches "distinct full screen report" without mixing into `RecordResultCard`.

**Menu entry opens a setup panel; Run closes the menu and starts the check.**
Extend `MenuPanel` with `"mail-dns-check"`. Panel fields: domain (required), DKIM selectors (comma-separated, default `default`). Validate domain non-empty before run. If WebSocket is not connected, block with the same connection-error affordance as ordinary lookups.

**Severity rules copied from the script verbatim.**
Examples: NS inconsistency → issue; SPF `~all` → warning; DMARC `p=none` → warning; missing PTR → issue; FCrdNS mismatch → warning; multiple `v=spf1` → issue. Overall status: `ERRORS` if any issue, else `WARNINGS` if any warning, else `OK`.

**PTR queries use the existing query-name convention for IP-shaped PTR input.**
For each MX IP, submit a `PTR` lookup using the IP as the domain field (same path as manual PTR-from-IP in the main form / `transformQueryInput`), via the default resolver.

## Risks / Trade-offs

- **Many WebSocket round-trips per check (NS count × record types × selectors)** → Mitigated by modest concurrency cap and progress UI; acceptable for a deliberate audit tool, not per-keystroke.
- **Secure-mode backends with a restrictive `allowed_dns_servers` list may block direct NS-IP queries** → Document that mail check needs the authoritative NS IPs reachable via `dns_server`, or that the default resolver must be allowlisted for discovery steps. Surface backend errors per query in the report rather than failing silently.
- **Large TXT / DKIM keys make HTML bulky** → Acceptable for a diagnostic report; truncate display in tables with full value in per-NS pre blocks (same as script).
- **DKIM selector guesswork** → User must supply selectors; empty list yields a warning (same as script when `DKIM_SELECTORS` is empty).

## Migration Plan

Purely additive UI feature behind a new menu entry. No config migration, no backend deploy dependency beyond what the app already needs. Rollback: remove menu entry and mail-check module.
