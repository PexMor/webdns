## 1. Backend: probe-friendly `/version` and forwarded-header logging

- [x] 1.1 Add `Cache-Control: no-store` header to the `/version` response in `dns-backend/src/version.rs`
- [x] 1.2 Read `X-Forwarded-For` / `X-Forwarded-Proto` headers where present and use them in connection tracing spans (`ws.rs` connect/disconnect logs, `main.rs` startup) in place of the raw TCP peer address
- [x] 1.3 Add/update backend tests covering the `no-store` header on `/version` and forwarded-header preference in logging

## 2. Runtime config: `identityProxy` support

- [x] 2.1 Add `identityProxy?: { enabled: boolean; probePath?: string }` to `RuntimeConfig`/config types in `webapp/src/types.ts`
- [x] 2.2 Parse and validate `identityProxy` in `webapp/src/loadConfig.ts` (default `enabled: false`, default `probePath: "/version"`, ignore non-object values without failing config load)
- [x] 2.3 Add `identityProxy` (disabled) to `webapp/public/config.json` and `dns-backend/config.example.toml`-adjacent default so the shipped default is inert
- [x] 2.4 Unit tests for config parsing: enabled/disabled/absent/invalid `identityProxy`

## 3. Session probe module

- [x] 3.1 Create `webapp/src/authProbe.ts` implementing `probeSession()` per design (`cache: "no-store"`, `redirect: "manual"`, `credentials: "include"`) returning `"ok" | "expired" | "offline"`
- [x] 3.2 Classify `opaqueredirect`/3xx as `"expired"`, unexpected `text/html` 200 as `"expired"`, network throw/5xx as `"offline"`, else `"ok"`
- [x] 3.3 Unit tests for each classification branch using mocked `fetch`

## 4. Auth-expired state store and re-login overlay

- [x] 4.1 Create `webapp/src/authProxyStore.ts` (module-level state + subscribe, mirroring `themeStore.ts`) exposing `authExpired`, `reportAuthExpired()`, `clearAuthExpired()`
- [x] 4.2 Create a blocking re-login overlay component (`role="alertdialog"`, `aria-modal="true"`) with a "Sign in again" action that calls `window.location.assign(window.location.href)`
- [x] 4.3 Mount the overlay at the top of `webapp/src/app.tsx`, subscribed to `authProxyStore`
- [x] 4.4 Wire startup probe and `visibilitychange` probe in `webapp/src/main.tsx` (gated on `identityProxy.enabled`), calling `reportAuthExpired()` on `"expired"`

## 5. WebSocket reconnect gating

- [x] 5.1 In `webapp/src/useDnsSocket.ts`, call `probeSession()` in `ws.onclose` before scheduling a reconnect, when `identityProxy.enabled`
- [x] 5.2 On `"expired"`: stop the backoff loop (no `setTimeout` scheduled), call `reportAuthExpired()`, and set a distinct status (do not reuse "check credentials" label)
- [x] 5.3 On `"offline"` or `"ok"`: preserve existing backoff/reconnect and close-code labeling behavior unchanged
- [x] 5.4 Tests covering: expired halts reconnect loop, offline continues it, ok continues it, disabled config bypasses all probing

## 6. Service worker rework (`injectManifest`)

- [x] 6.1 Switch `webapp/vite.config.js` `VitePWA` config from `generateSW` to `strategies: "injectManifest"`, pointing at a new `webapp/src/sw.ts`
- [x] 6.2 Implement `webapp/src/sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)` (via a `PrecacheController` with an `authInterceptGuard` plugin), custom `fetch` handler with `isAuthIntercept()` guard (opaqueredirect/3xx/unexpected-HTML) that skips cache writes and falls back to existing cache or network response
- [x] 6.3 Add network-first/network-only handling for `config.json`, the configured probe path, and navigation requests (`request.mode === "navigate"`)
- [x] 6.4 On `activate`, fetch `config.json` once to read `identityProxy`, then probe `probePath`; on intercept, `postMessage({ type: "AUTH_EXPIRED" })` to all window clients
- [x] 6.5 On any runtime auth intercept during `fetch`, `postMessage({ type: "AUTH_EXPIRED" })` to all window clients
- [x] 6.6 Add a `navigator.serviceWorker` `message` listener in `webapp/src/main.tsx` that calls `reportAuthExpired()` on `AUTH_EXPIRED`
- [x] 6.7 Verify `registerType: "autoUpdate"` behavior and asset precaching are unchanged for the `identityProxy.enabled: false` default (no new network calls, no console errors) — verified live in a browser via `yarn build && yarn preview`; caught and fixed a real bug where the auth-intercept guard flagged the legitimate precached `icons/icon.html` asset as an intercept, failing SW install (`bad-precaching-response`) regardless of `identityProxy.enabled`. Fixed by excluding `.html`-suffixed URLs from the content-type check and gating the `AUTH_EXPIRED` notification on `identityProxyEnabled`. Also verified the full enabled-path flow end-to-end (mocked `/version` as an HTML login page → blocking overlay appeared correctly).

## 7. Recovery flow

- [x] 7.1 After a successful re-probe (e.g. triggered by returning to the tab post-login), call `clearAuthExpired()` and trigger `registration.update()` / reload so stale state and the WebSocket connection are refreshed
- [x] 7.2 Confirm the WS reconnect loop restarts cleanly after the overlay clears (either via full reload from top-level navigation, or an explicit "retry" affordance if standalone-mode testing shows `location.assign` is disruptive — see design Open Questions) — the overlay's "Sign in again" button does a full `location.assign` reload (verified in browser), and the automatic visibilitychange re-probe path does `location.reload()` once it observes recovery, so the WS always restarts via a fresh page load rather than in-place patching.

## 8. Deployment docs

- [x] 8.1 Write `docs/cloudflare-tunnel.md` with two `cloudflared` ingress examples: whole-app protected, and API-only (`/ws` + `/version`) protected with public static shell
- [x] 8.2 Document the API-only requirement that `/version` (or the configured `probePath`) must be in the *same* Access scope as `/ws`
- [x] 8.3 Document setting `identityProxy.enabled: true` in the deployed `config.json` and choosing `probePath` if non-default

## 9. Manual verification

- [x] 9.1 Run the skill's §6 procedure against a local `cloudflared`+Access (or mocked proxy) setup: confirm normal operation, then simulate expiry (delete session cookie / revoke Access session) and confirm the blocking overlay appears with no infinite WS reconnect spam — verified with a mocked proxy (routed `/config.json` to enable `identityProxy` and `/version` to return an HTML login page) against `yarn build && yarn preview` in a real browser: overlay appeared correctly, no console errors, no reconnect spam.
- [ ] 9.2 Confirm "Sign in again" completes the Access flow and the app recovers (API + WebSocket both functional, probe returns `"ok"`) — **not fully verifiable in this environment** (no real Cloudflare Access/`cloudflared` tunnel available); the button's `location.assign` behavior and post-recovery reload logic were code-reviewed and unit/manual-tested up to the point of the actual Access redirect. Needs a real deployment to confirm end-to-end — see `docs/cloudflare-tunnel.md` §4.
- [x] 9.3 Confirm offline behavior (network disabled) shows normal offline handling, not the re-login overlay — verified in-browser with `identityProxy.enabled: true` and `page.context().setOffline(true)`: probe correctly classified as `"offline"`, overlay did not appear. Also covered by `authProbe.test.ts` unit tests.
- [x] 9.4 Confirm `identityProxy.enabled: false` (default/local dev) shows zero behavior change from before this change — verified in-browser: no overlay, clean console, SW installs/activates normally with the default shipped `config.json`.
