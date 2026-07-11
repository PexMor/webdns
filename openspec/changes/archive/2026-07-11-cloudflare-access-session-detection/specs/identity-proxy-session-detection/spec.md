## ADDED Requirements

### Requirement: Session Probe Classification
When `identityProxy.enabled` is true, the web client SHALL provide a `probeSession()` function that issues a same-origin `GET` request to the configured `identityProxy.probePath` with `cache: "no-store"`, `redirect: "manual"`, and `credentials: "include"`, and classifies the result as exactly one of `"ok"`, `"expired"`, or `"offline"`.

#### Scenario: Proxy redirect classified as expired
- **WHEN** the probe response has `type === "opaqueredirect"` or an HTTP status in the 300-399 range
- **THEN** `probeSession()` resolves to `"expired"`

#### Scenario: Proxy login page served with 200 classified as expired
- **WHEN** the probe response has HTTP status 200 but a `Content-Type` containing `text/html` where the probed resource is expected to be non-HTML
- **THEN** `probeSession()` resolves to `"expired"`

#### Scenario: Successful probe
- **WHEN** the probe response is a successful (2xx) non-HTML response from the app's own backend
- **THEN** `probeSession()` resolves to `"ok"`

#### Scenario: Network failure classified as offline, not expired
- **WHEN** the probe request throws (network error/timeout) or the response is a server error (5xx)
- **THEN** `probeSession()` resolves to `"offline"` and the client does not treat this as a session expiry

#### Scenario: Probing disabled
- **WHEN** `identityProxy.enabled` is false or absent from `config.json`
- **THEN** the client never calls `probeSession()` and none of the behaviors in this capability are active

### Requirement: Probe Triggers
When `identityProxy.enabled` is true, the web client SHALL call `probeSession()` at application startup, whenever the document's `visibilityState` transitions to `visible`, and before scheduling any WebSocket reconnect attempt after a `close` or `error` event.

#### Scenario: Startup probe
- **WHEN** the app loads and `identityProxy.enabled` is true
- **THEN** `probeSession()` runs before the client treats the cached app shell or any prior WebSocket connection state as trustworthy

#### Scenario: Tab refocus probe
- **WHEN** the document becomes visible again after being hidden (e.g., the user switches back to the tab or reopens the installed PWA)
- **THEN** `probeSession()` runs

#### Scenario: Pre-reconnect probe on WebSocket close
- **WHEN** the WebSocket connection to the backend closes or errors and the client would otherwise schedule a reconnect attempt
- **THEN** the client calls `probeSession()` before scheduling that attempt

### Requirement: WebSocket Reconnect Gating on Expired Session
When `identityProxy.enabled` is true and a pre-reconnect probe (per Probe Triggers) classifies the session as `"expired"`, the web client SHALL NOT schedule or perform further WebSocket reconnect attempts and SHALL report the session as expired instead.

#### Scenario: Reconnect loop halted on expiry
- **WHEN** the WebSocket closes and the subsequent probe returns `"expired"`
- **THEN** the client stops its backoff/reconnect loop, does not schedule another attempt, and signals session expiry (see Blocking Re-Login Prompt) instead of showing a generic "connection failed" state

#### Scenario: Reconnect loop continues when offline
- **WHEN** the WebSocket closes and the subsequent probe returns `"offline"`
- **THEN** the client continues its existing backoff/reconnect behavior unchanged

#### Scenario: Reconnect loop continues when session is fine
- **WHEN** the WebSocket closes and the subsequent probe returns `"ok"`
- **THEN** the client continues its existing backoff/reconnect behavior and existing close-code-based labeling (e.g. "check credentials") unchanged

### Requirement: Blocking Re-Login Prompt
The web client SHALL show a blocking, un-dismissable re-login prompt whenever a session is classified as expired (via any probe trigger or a service worker `AUTH_EXPIRED` notification), and the prompt's primary action SHALL perform a top-level navigation back to the app's own URL rather than a background request.

#### Scenario: Prompt appears on expiry
- **WHEN** any probe trigger or the service worker reports the session as expired
- **THEN** a full-screen or otherwise unmissable overlay appears with a "Sign in again" action, and it remains visible until the session is confirmed valid again

#### Scenario: Sign-in action navigates, does not fetch
- **WHEN** the user activates "Sign in again"
- **THEN** the client performs a top-level navigation (e.g. `window.location.assign`) to the app's own origin, allowing the identity-aware proxy to run its login flow and set a fresh session cookie

#### Scenario: Prompt clears after successful re-authentication
- **WHEN** the user completes the proxy's login flow and returns to the app
- **THEN** the app reloads or re-probes, confirms `"ok"`, and no longer shows the re-login prompt

### Requirement: Service Worker Auth-Intercept Handling
When `identityProxy.enabled` is true, the web client's service worker SHALL NOT cache a response that is a redirect or unexpected-HTML intercept of a non-navigation request under that request's cache key, and SHALL notify open window clients when such an intercept occurs.

#### Scenario: Intercepted response not cached
- **WHEN** the service worker fetches a non-navigation, non-HTML asset (e.g. `config.json`, the probe path, a script) and the response is a redirect, `opaqueredirect`, or unexpected HTML
- **THEN** the service worker does not write that response into its cache under the original asset's key, and falls back to any existing cached copy of that asset (or the network response) without poisoning the cache

#### Scenario: Clients notified of intercept
- **WHEN** the service worker detects an auth intercept as described above, or detects one during its `activate` check of the probe path
- **THEN** it posts an `{ type: "AUTH_EXPIRED" }` message to all open window clients

#### Scenario: Sensitive paths bypass cache-first strategy
- **WHEN** a request targets `config.json`, the configured probe path, or a navigation request
- **THEN** the service worker always attempts the network first (network-first or network-only) rather than serving a cached copy first, so an expired session is observable rather than masked
