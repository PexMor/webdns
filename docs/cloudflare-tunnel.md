# Running behind a Cloudflare Tunnel + Access

This app can be exposed to the internet through `cloudflared` (Cloudflare Tunnel) with Cloudflare
Access sitting in front as an identity-aware proxy, instead of opening a port directly. You choose
one of two topologies when you scope the Access application: protect the **whole app**, or protect
**only the API** (`/ws` and `/version`) while leaving the static PWA shell public.

Either way, once a user's Access session expires, Cloudflare intercepts requests to the protected
paths and returns its own redirect/login page instead of the app's response. The webapp detects
this (see the `identity-proxy-session-detection` capability) and shows a blocking "sign in again"
prompt — but only when you turn it on, and only if the probe path stays inside the same Access
scope as the WebSocket API. Both requirements are covered below.

## 1. Choose a topology

### Whole-app protected

Simplest to reason about: every request — the static shell, `/version`, and `/ws` — requires a
valid Access session. Nobody can even load the page without signing in first.

`cloudflared` `config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: dns.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

In the Cloudflare Zero Trust dashboard, create one Access application scoped to
`dns.example.com` (all paths).

### API-only protected

The static PWA shell is public (anyone can load the app UI), but the DNS resolver API — the thing
that actually costs you something to run — requires a valid Access session. This is useful if you
want the app installable/browsable without a login wall, but still want to gate actual usage.

`cloudflared` `config.yml` (same single ingress rule; the path-level split happens in the Access
application, not in `cloudflared`):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: dns.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

In the Cloudflare Zero Trust dashboard, create an Access application scoped to
`dns.example.com/ws` **and** `dns.example.com/version` — not the whole hostname.

> **Important:** `/version` doubles as this app's session probe target. In the API-only topology,
> `/version` and `/ws` **must be in the same Access scope**. If you protect `/ws` but leave
> `/version` public, the probe will always report `"ok"` even though `/ws` is actually gated (the
> user gets stuck with a silent connection failure instead of the re-login prompt). If you protect
> `/version` but not `/ws`, the reverse can happen. Add both paths to the same Access application,
> or set `identityProxy.probePath` (see below) to a path that's genuinely inside the same scope as
> `/ws`.

## 2. Turn on session-expiry detection in the app

By default `identityProxy.enabled` is `false` and the app behaves exactly as it does today — no
probing, no overlay, zero behavior change. Once Access is in front of the deployment, edit the
`config.json` served alongside the built app (`docs/app/config.json`, or wherever `serve_web`
points `dns-backend` at) and set:

```json
{
  "identityProxy": {
    "enabled": true,
    "probePath": "/version"
  }
}
```

- `enabled: true` turns on the startup probe, the `visibilitychange` re-probe, the pre-reconnect
  WebSocket probe, and the blocking re-login overlay.
- `probePath` defaults to `/version`. Only change it if your Access scope protects a different
  path than `/version`+`/ws` together — whatever you set here must be inside the same Access
  scope as `/ws`, per the callout above.

No `cloudflared` or Access configuration references `identityProxy` — it's purely a client-side
flag telling the webapp "yes, expect an identity proxy in front of you, probe for it."

## 3. What the user sees

- **Normal operation:** no visible difference from a non-Access deployment.
- **Session expires while using the app:** the next WebSocket reconnect attempt (or the next time
  the tab regains focus) detects the intercepted response and shows a blocking "Session expired"
  prompt with a **Sign in again** button. Clicking it does a full top-level navigation back to the
  app's own URL, which Cloudflare Access intercepts and runs its login flow against; on success the
  user lands back in the app with a fresh session and the WebSocket reconnects automatically.
- **Offline (no network at all):** the probe reports `"offline"`, not `"expired"` — the app falls
  back to its normal offline/PWA-shell behavior instead of showing the re-login prompt.

## 4. Verifying a deployment

1. Deploy with `identityProxy.enabled: true` and confirm normal usage works (API queries succeed,
   WebSocket connects).
2. In the Cloudflare Zero Trust dashboard, revoke the current user's Access session (Access →
   Users → revoke), or wait out a short session duration configured on the Access application for
   testing.
3. Trigger a probe: switch away from the tab and back, or wait for the next WebSocket reconnect
   attempt.
4. Confirm the blocking "Session expired" overlay appears (not an infinite silent reconnect loop),
   and that clicking **Sign in again** successfully completes the Access login flow and restores
   the app.
