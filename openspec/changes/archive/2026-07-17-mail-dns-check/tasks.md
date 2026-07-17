## 1. Report model & check logic core

- [x] 1.1 Add `webapp/src/mailDnsCheck/types.ts` with `MailDnsCheckReport`, `CheckFinding` (`issue` | `warning` | `pass`), `NameserverInfo`, `ConsistencyRow`, `MxHostRow`, `PerNsRecords`, and `MailDnsCheckInput` (`domain`, `dkimSelectors: string[]`).
- [x] 1.2 Add `normalizeRecordLines(raw: string[]): string[]` and `recordsMatch(files: string[][]): boolean` mirroring the script's sort/trim/compare behavior.
- [x] 1.3 Add `extractSpfLines(txtRecords: string[]): string[]` (case-insensitive `v=spf1` filter) reusing or delegating to `parseSpfTerms` where useful.
- [x] 1.4 Add `hostnameMatch(a, b)` (trailing-dot strip, case-insensitive) for FCrdNS checks.
- [x] 1.5 Unit tests for normalization, consistency matching, SPF extraction, and hostname matching.

## 2. Query orchestration

- [x] 2.1 Define `MailDnsQueryFn` type: `(req: { domain: string; recordTypes: string[]; dnsServer?: string }) => Promise<DnsQueryResponse>` and `MailDnsCheckProgress` callback shape.
- [x] 2.2 Implement `discoverAuthoritativeNs(domain, query, defaultResolver)` — `NS` then `A` per NS host — returning `{ hostname, ip }[]`.
- [x] 2.3 Implement `queryRecordsPerNs(domain, nsIps, selectors, query)` — apex TXT, `_dmarc` TXT, MX, DKIM TXT/CNAME per selector per NS IP — storing raw answers keyed by NS IP.
- [x] 2.4 Implement `queryMxHosts(mxExchanges, query, defaultResolver)` — A, AAAA, PTR per MX IP.
- [x] 2.5 Implement `runMailDnsCheck(input, query, { onProgress, defaultResolver })` composing discovery → per-NS queries → MX checks → validation → `MailDnsCheckReport`; cap concurrent queries (e.g. 4).
- [x] 2.6 Unit tests with a mocked `MailDnsQueryFn` covering: consistent NS, split-brain SPF, missing DMARC, DKIM per selector, MX without A, FCrdNS pass/fail.

## 3. Policy validation (parity with script)

- [x] 3.1 Implement `checkNsConsistency` — SPF, DMARC, MX, DKIM TXT/CNAME across NS IPs.
- [x] 3.2 Implement `checkMailPolicy` — SPF presence/single-record/qualifier heuristics; DMARC `v=DMARC1`, `p=` policy, `rua=` warning; DKIM presence per selector; MX presence.
- [x] 3.3 Implement `checkMxFcrds` — missing A → issue; missing PTR → issue; PTR mismatch → warning.
- [x] 3.4 Compute overall status (`OK` / `WARNINGS` / `ERRORS`) and aggregate `issues`, `warnings`, `passes` arrays.
- [x] 3.5 Unit tests for each policy rule (mirror script cases: `-all` pass, `~all` warning, `p=none` warning, multiple SPF issue).

## 4. HTML export

- [x] 4.1 Add `renderReportHtml(report: MailDnsCheckReport): string` — standalone `<!DOCTYPE html>` with embedded CSS (based on script's report styles), all sections from the markdown report.
- [x] 4.2 Add `downloadReportHtml(report, filename?)` using `Blob` + temporary `<a download>` (reuse or extend `copyToClipboard.ts` patterns if a shared download helper exists).
- [x] 4.3 Unit test: output contains `<style>`, domain title, summary status, and no external `href`/`src` dependencies.

## 5. In-app full-screen report UI

- [x] 5.1 Add `MailDnsCheckReportView.tsx` — renders the same sections as HTML export (summary, errors, warnings, tables, per-NS detail, passes) using existing app typography/CSS variables where practical.
- [x] 5.2 Add header chrome: domain, generated timestamp, **Back** (dismiss report), **Download HTML**.
- [x] 5.3 In `app.tsx`, add `mailDnsReport` state; when set, hide main lookup UI and show `MailDnsCheckReportView` full-screen.

## 6. Menu panel & run flow

- [x] 6.1 Extend `MenuPanel` with `"mail-dns-check"` in `menu.tsx`.
- [x] 6.2 Add `MailDnsCheckPanel` in menu: domain input, DKIM selectors input (comma-separated, placeholder `default`), Run button, brief help text (selectors from `DKIM-Signature` header).
- [x] 6.3 Add hamburger nav entry **Mail DNS check** opening the panel.
- [x] 6.4 Wire Run: validate inputs, require WebSocket connected (show error if not), close menu, show progress indicator in main chrome, call `runMailDnsCheck` with the socket `query` function and selected default DNS server, set `mailDnsReport` on completion.
- [x] 6.5 Handle run errors (backend unreachable mid-run) with a dismissible error state, not a silent hang.

## 7. Verification

- [x] 7.1 Run `webapp` unit tests and type checker.
- [x] 7.2 Manual test against a real domain: compare webapp report sections and severity counts with `DOMAIN=… DKIM_SELECTORS=… ./tmp/01_dns_check.sh` output for the same domain.
- [x] 7.3 Confirm downloaded HTML opens offline in a browser and matches in-app report content.
