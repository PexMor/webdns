## Why

Email authentication (SPF, DMARC, DKIM) and MX deliverability depend on records being present, correctly configured, and consistent across every authoritative nameserver. Today that validation lives only in an external shell script (`tmp/01_dns_check.sh`). Operators who already use the web DNS client for exploration have no equivalent workflow inside the app — they must leave the browser, run `dig` loops or the script, and manually collate results.

## What Changes

- Add a **Mail DNS check** tool reachable from the hamburger menu (alongside History, Settings, etc.).
- The tool accepts a domain and one or more DKIM selectors (comma-separated; selectors cannot be discovered automatically), then runs the same check suite as `01_dns_check.sh`:
  - Discover authoritative nameservers and their IPs.
  - Query SPF (apex TXT filtered to `v=spf1`), DMARC (`_dmarc.<domain>` TXT), DKIM (`<selector>._domainkey.<domain>` TXT and CNAME), and MX from **each** authoritative NS IP via the existing backend `dns_server` field.
  - Compare normalized answers across NS for consistency.
  - Resolve each MX hostname (A/AAAA), then PTR for each MX IP, and validate FCrdNS.
  - Apply policy heuristics (SPF terminal qualifier, single SPF record, DMARC `v=DMARC1` / `p=` policy, DKIM presence, MX resolution).
- Present results as a **full-screen in-app report** (distinct from ordinary lookup results) with summary status (`OK` / `WARNINGS` / `ERRORS`), errors, warnings, consistency tables, MX host resolution, and per-NS raw record dumps — matching the sections in `tmp/01_dns_check.md`.
- Offer **Download HTML** that produces a single self-contained `.html` file (embedded CSS, no external assets) suitable for sharing or archiving offline.
- All DNS resolution goes through the **existing WebSocket backend**; no new backend endpoints or wire-format changes.

## Capabilities

### New Capabilities
- `mail-dns-check`: defines the mail-auth check orchestration, validation rules, in-app full-screen report, and self-contained HTML export.

### Modified Capabilities
- `dns-web-client`: hamburger menu gains a Mail DNS check entry; the client supports a dedicated full-screen report view that does not replace or mix with the standard per-lookup results panel.

## Impact

- New `webapp/src/mailDnsCheck/` module (or similar): query orchestration, record normalization/comparison, policy checks, report model, HTML renderer.
- `webapp/src/menu.tsx`: new menu panel / navigation entry for Mail DNS check.
- `webapp/src/app.tsx`: route or view state for full-screen report; wire check runner to `useDnsSocket.query` (or equivalent programmatic query API).
- Reuse existing SPF parsing (`rr/records/spf.ts`) and IP/hostname utilities where applicable.
- Tests for consistency logic, policy heuristics, and HTML export shape.
- No `dns-resolver-backend` changes.
