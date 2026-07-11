## Why

The webapp is going to be hosted behind a `cloudflared` tunnel with Cloudflare Access (or a similar identity-aware reverse proxy) in front of either the whole app or just the API (`/ws`, `/version`). When the Access session expires, the proxy silently swaps API/WebSocket responses for an HTML login page or a redirect. Today the client has no way to tell that apart from a bad API key, a down server, or a network outage: `useDnsSocket` labels every 1006/1008/1002 close as "connection failed (check credentials)" and retries forever, the PWA's service worker can cache the login page over real assets, and the user is left staring at a stuck app with no visible way to sign back in.

## What Changes

- Add a same-origin **auth sentinel probe** (`probeSession()`) that distinguishes "session expired" (redirect/opaqueredirect/HTML-where-JSON-expected) from "offline" (network error) from "ok", using `cache: "no-store"` and `redirect: "manual"`.
- Run the probe at startup, on `visibilitychange` back to visible, and — critically — **before scheduling a WebSocket reconnect** in `useDnsSocket`, since a WS `close`/`error` never exposes the underlying HTTP status.
- Add a blocking, full-screen **re-login overlay** that appears when the probe reports "expired", offering a "Sign in again" action that performs a top-level navigation (never a background fetch) back through the proxy so the identity flow can complete.
- Rework the generated service worker (switch `vite-plugin-pwa` to `injectManifest` with custom logic, or add equivalent Workbox runtime rules) so that: (1) an intercepted HTML/redirect response is never cached under a non-HTML asset's key, (2) `config.json`, `/version`, the auth-probe resource, and navigation requests stay network-first/network-only, and (3) the SW `postMessage`s clients (`AUTH_EXPIRED`) so the page can show the overlay even when the tab is backgrounded.
- Extend `config.json` / `RuntimeConfig` with an opt-in `identityProxy` block (`enabled`, `probePath`) so deployments not sitting behind Access (e.g. local dev) don't run probe logic or show the overlay.
- Add backend support for running correctly behind a reverse proxy/tunnel: trust `X-Forwarded-*` for logging, and serve a small always-available, never-cached probe resource (reuse `/version` with `Cache-Control: no-store`, or add `/auth-probe.txt`) at both the app-serving and API-only routes so the probe works whether Access protects the whole app or just the API.
- Add deployment docs/example `cloudflared` ingress config showing both topologies: (a) Access in front of the whole origin, (b) Access in front of `/ws` and `/version` only with the static app left public, plus how the probe path must stay reachable/unauthenticated in the "API-only" topology relative to the app shell.

## Capabilities

### New Capabilities
- `identity-proxy-session-detection`: Client-side detection of an identity-aware proxy (Cloudflare Access-style) session expiry via a sentinel probe, a blocking re-login overlay, WebSocket reconnect-loop gating, and service-worker rules that never mask an auth intercept behind a cached asset.

### Modified Capabilities
- `webapp-runtime-config`: `config.json` gains an `identityProxy` block controlling whether probe/overlay behavior is active and which path to probe.
- `dns-web-client`: "Connection State Feedback" gains a distinct "session expired, sign-in required" state separate from bad-credentials/offline states, surfaced via the re-login overlay instead of the existing reconnect-backoff label.
- `dns-resolver-backend`: Backend exposes a never-cached probe-friendly response (extends `/version` semantics) and documents/handles running behind a reverse proxy (trusting forwarded headers for logging).

## Impact

- `webapp/src/`: new `authProbe.ts`, new re-login overlay component, changes to `useDnsSocket.ts` (probe before reconnect), `loadConfig.ts`/`types.ts` (`identityProxy` config), `main.tsx` (startup + visibilitychange probe, SW message listener).
- `webapp/vite.config.js`: switch `vite-plugin-pwa` strategy (or add workbox runtime caching rules) to satisfy the never-cache-auth-intercept rules; likely a new `webapp/src/sw.ts` if moving to `injectManifest`.
- `webapp/public/config.json` (and `dns-backend` served default): add `identityProxy` block.
- `dns-backend/src/main.rs`, `version.rs`: `Cache-Control: no-store` on `/version` (or new probe route), optional forwarded-header trust for logging.
- New docs: example `cloudflared` config/ingress rules and Cloudflare Access setup notes for both "whole app" and "API-only" topologies (likely under `docs/`).
- No breaking changes to existing auth (app-level API key over `/ws`) — this adds a second, independent layer for the reverse-proxy's own session, opt-in via config so non-Access deployments are unaffected.
