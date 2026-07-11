## Context

The app is a Vite + Preact PWA (`webapp/`) built with `vite-plugin-pwa` (Workbox `generateSW` strategy, `registerType: "autoUpdate"`), talking to a Rust/axum backend (`dns-backend/`) over a single WebSocket (`/ws`) that already has its own app-level API key auth (query param or header, checked in `ws.rs::ws_handler` before upgrade). The backend also serves the built static app via `ServeDir` when `serve_web` is enabled, and exposes an unauthenticated `GET /version`.

The deployment target adds `cloudflared` (Cloudflare Tunnel) plus Cloudflare Access in front of this origin, in one of two topologies chosen by the operator via Access application scope, not by this app:

- **Whole-app**: Access protects every path (`/`, `/ws`, `/version`, static assets). The static shell itself is only reachable with a valid Access session.
- **API-only**: Access protects only `/ws` (and optionally `/version`); the static app shell is public so it can load, then hits the auth wall when it tries to reach the API.

Both topologies produce the same client-visible symptom on session expiry: Access intercepts the request and returns its own 302/HTML instead of the app's response. For `fetch()` this is inspectable; for the WebSocket upgrade it is not (the browser only exposes `close`/`error` with no HTTP status). The existing `useDnsSocket` reconnect loop (`webapp/src/useDnsSocket.ts`) treats every 1006/1008/1002 close as "check credentials" and retries with backoff forever — indistinguishable from a wrong app-level API key or a genuinely down server, and it never tells the user to sign back in to Access.

This design is scoped to detecting and surfacing *proxy* session expiry client-side, plus the minimal backend/deployment support needed to make detection reliable in both topologies. It reuses the `pwa-cloudflare` skill's sentinel-probe pattern.

## Goals / Non-Goals

**Goals:**
- Deterministically distinguish "Access session expired" from "offline" from "app API key wrong" from "server down", in the browser.
- Surface a blocking, unmissable re-login prompt that recovers via top-level navigation (the only mechanism that can complete the Access identity flow).
- Make the service worker incapable of masking an auth intercept behind a cached asset, in either topology.
- Keep this entirely opt-in via `config.json` (`identityProxy.enabled`) so local/dev/non-Access deployments are unaffected — zero behavior change when disabled.
- Work correctly whether Access sits in front of the whole app or just `/ws`+`/version`.

**Non-Goals:**
- Implementing or configuring Cloudflare Access itself (policies, IdP, `cloudflared` daemon lifecycle) — this change ships example config/docs only, not infra automation.
- Replacing or touching the existing app-level API key auth on `/ws` — that stays as a second, independent layer.
- Server-side session validation, token refresh, or any awareness of Access's actual JWT (`CF_Authorization` is `HttpOnly`; the app never reads it).
- General-purpose reverse-proxy support beyond what's needed for correct logging and a reliable probe target.

## Decisions

### 1. Sentinel probe target: reuse `/version`, not a new dedicated file
`/version` already exists, is unauthenticated at the app layer, returns JSON (easy to assert non-HTML), and is present in both topologies (it's one of the two paths Access would protect in "API-only" mode, so it's a faithful probe of exactly the thing that matters). We add `Cache-Control: no-store` to its response so HTTP caches/CDN never mask an intercept, and probe it with `cache: "no-store", redirect: "manual", credentials: "include"` per the skill pattern. We rejected adding a brand-new `/auth-probe.txt`: it would need to be added to *both* topologies' Access scope consistently, whereas `/version` is already a natural inclusion in the "API-only" protected set and also present when the whole app is protected.

### 2. Probe path is configurable, not hardcoded
`config.json` gains:
```json
"identityProxy": { "enabled": false, "probePath": "/version" }
```
`enabled: false` (the default) fully disables probing, the overlay, and the WS pre-reconnect check — existing deployments (including local dev, `yarn dev` against `127.0.0.1:8080`) see no behavior change. `probePath` defaults to `/version` but stays overridable in case an operator's Access scope only covers a different path.

### 3. WebSocket reconnect gating happens in `useDnsSocket`, not a separate global watcher
Alternative considered: a single app-wide "connectivity watchdog" independent of the socket hook. Rejected because the socket hook already owns the reconnect/backoff state machine (`webapp/src/useDnsSocket.ts`) and close-code interpretation (`closeLabel`); bolting an external watchdog on top would create two sources of truth for "why are we not connected." Instead, `ws.onclose` calls `probeSession()` (when `identityProxy.enabled`) *before* scheduling the next backoff attempt:
- `"expired"` → stop the reconnect loop, set a new `status: "auth-expired"`, let the overlay take over. No further reconnect attempts are scheduled until the user re-authenticates and the page reloads.
- `"offline"` → keep today's behavior (backoff + retry), since the skill's rule is explicit that offline must never be treated as expired.
- `"ok"` → keep today's behavior too — the WS failure was something else (bad app-level API key, server restart), so the existing "check credentials" label still applies.

### 4. Re-login overlay is a single global component owned by `app.tsx`, driven by a small store
A new `authProxyStore.ts` (mirrors the existing `themeStore.ts`/`displayPrefsStore.ts` pattern: module-level state + subscribe) exposes `authExpired` boolean and `reportAuthExpired()` / `clearAuthExpired()`. Three call sites feed it: startup probe, `visibilitychange`, and the WS pre-reconnect probe from Decision 3; a fourth is the SW `message` listener (`AUTH_EXPIRED`) per the skill's Rule 3. The overlay renders at the top of `app.tsx`, above routing/menu state, and blocks interaction (`role="alertdialog"`, `aria-modal="true"`) — consistent with how `RecordTypeHelpModal` is already layered. "Sign in again" calls `window.location.assign(window.location.href)`, a top-level navigation, never a background fetch.

### 5. Service worker: switch from `generateSW` to `injectManifest`
The current `vite.config.js` uses `VitePWA({ registerType: "autoUpdate", workbox: { navigateFallbackDenylist: [/^\/ws/] } })` — a Workbox-generated SW with no custom fetch logic. The skill's Rule 1 (never cache an HTML/redirect response under a non-HTML asset's key) and Rule 3 (`postMessage` clients on intercept) both require code in the `fetch` handler that `generateSW` doesn't expose a hook for. We switch to `injectManifest`, adding `webapp/src/sw.ts`:
- `precacheAndRoute(self.__WB_MANIFEST)` for the app shell (unchanged behavior for normal assets).
- A custom `fetch` handler wrapping the existing cache-first-for-assets behavior with the `isAuthIntercept()` guard from the skill (checks `response.type === "opaqueredirect"`, 3xx status, or unexpected `text/html` content-type) — on intercept, skip the cache write and `postMessage({ type: "AUTH_EXPIRED" })` to all window clients.
- `config.json`, `/version` (the probe path), and navigation requests (`request.mode === "navigate"`) stay network-first, matching `navigateFallbackDenylist` intent already present today.
- This only activates the intercept-detection logic when `identityProxy.enabled` is true in the fetched `config.json` (the SW fetches it once on `activate`, mirroring the client), so disabled deployments keep today's plain cache-first Workbox behavior with no extra network chatter.

Alternative considered: stay on `generateSW` and rely on `workbox.runtimeCaching` `NetworkFirst`/`NetworkOnly` entries for the sensitive paths, skipping the postMessage/never-poison-cache logic entirely. Rejected because it only gets us Rule 2 (right caching strategy per route) but not Rules 1/3 — a backgrounded tab would still have no way to learn its session died until the next foreground probe, defeating the WS-close detection story for tabs that aren't actively reconnecting.

### 6. Backend: `Cache-Control: no-store` on `/version`; no new auth surface
Add the header in `dns-backend/src/version.rs`'s handler. No change to `ws_handler`'s auth logic — Access sits in front of axum entirely (via `cloudflared` and, in the whole-app topology, in front of `ServeDir` too), so the backend has no visibility into Access sessions and doesn't need any. For forwarded-header trust: add optional `X-Forwarded-For`/`X-Forwarded-Proto` logging in the tracing span so operator logs show real client IPs behind the tunnel — this is observability only, not a security control (`cloudflared` terminates the tunnel; we trust it the same way any reverse-proxy deployment does).

### 7. Deployment docs, not automation
Add `docs/cloudflare-tunnel.md` with two worked `cloudflared` `config.yml` ingress examples (whole-app vs API-only) and the Access application setup notes (which hostnames/paths to include, and — for API-only — an explicit callout that `/version` must remain inside the *same* Access scope as `/ws`, otherwise the probe will report "ok" while `/ws` is actually gated, or vice versa). This is documentation only; no Terraform/automation is introduced.

## Risks / Trade-offs

- **[Risk]** API-only topology misconfiguration: operator protects `/ws` but not `/version` (or vice versa) → probe and reality disagree (probe says "ok", `/ws` still 401/redirects, or the reverse). → **Mitigation**: `docs/cloudflare-tunnel.md` calls this out explicitly as the one hard requirement; `probePath` is also configurable per-deployment in case an operator's scope genuinely differs and needs a different probe target.
- **[Risk]** `injectManifest` migration changes SW build output/registration subtly (cache names, update flow). → **Mitigation**: keep `registerType: "autoUpdate"` behavior equivalent, verify via the skill's §6 manual test procedure (kill session, expect blocking prompt, no infinite WS spam) plus a plain offline check (probe must return "offline", not "expired", with network disabled).
- **[Risk]** Overlay false-positives if `/version` is ever legitimately slow/5xx during a deploy, momentarily read as network trouble. → **Mitigation**: probe classifies 5xx as `"offline"`, not `"expired"` (per skill rules), so deploys don't trigger the re-login prompt.
- **[Trade-off]** Reusing `/version` as the probe couples an observability endpoint to an auth-detection role. Accepted because it avoids a second path to keep in sync across both Access topologies, and `/version` is already required to be public/reachable per its existing spec (`dns-resolver-backend`).

## Migration Plan

1. Ship with `identityProxy.enabled: false` by default in `webapp/public/config.json` — no behavior change on deploy.
2. Backend: add `Cache-Control: no-store` to `/version` (safe, additive).
3. Frontend: land probe module, overlay, `useDnsSocket` gating, and the `injectManifest` SW switch behind the config flag; verify existing (non-Access) dev/prod flows are unaffected (`identityProxy.enabled: false` short-circuits all new code paths).
4. Operators who front the app with Cloudflare Access flip `identityProxy.enabled: true` (and set `probePath` if they don't use the default) in their deployed `config.json`, following `docs/cloudflare-tunnel.md`.
5. Rollback: setting `identityProxy.enabled: false` (or reverting `config.json`) fully disables the new behavior without a code rollback.

## Open Questions

- Should the re-login overlay's "Sign in again" also work for an installed/standalone PWA where `window.location.assign` inside the standalone window may not be the ideal UX (skill suggests an alternative `window.open` + "I've signed in — retry" flow for that case)? Deferred to tasks/implementation — start with `location.assign`, revisit if standalone-mode testing shows friction.
- Should `/version`'s response body change at all, or only its headers? Current design: headers only, to avoid touching the `dns-resolver-backend` spec's existing response-shape scenarios.
