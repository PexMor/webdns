## Context

The starting point is a blueprint (not yet code) for a Rust/axum WebSocket backend using `hickory-resolver`, plus a one-line PWA client sketch. This is a greenfield repo (`webdns`) — no existing Cargo crate, no existing spec history. The goal is a small, runnable local tool: a user starts the backend, opens a web page, types a domain, picks record types, and sees results stream back. Single-user / local-network use is assumed (API key over a query param is acceptable for that threat model, not for public internet exposure).

## Goals / Non-Goals

**Goals:**
- Working `dns-backend` Rust crate that compiles and runs, implementing config layering, WebSocket auth, and concurrent multi-record-type DNS resolution.
- A minimal static web client (HTML/JS, PWA-installable) served by the same backend (no separate frontend build/deploy step) that exercises the full request/response protocol.
- Config precedence CLI > env > TOML, matching the blueprint, with a sensible default bind address.

**Non-Goals:**
- No user accounts, multi-tenant auth, or persistent storage/history of past queries.
- No production TLS termination (wss://) — documented as a deployment concern, not built here.
- No DNS server functionality (this is a resolver client, not an authoritative/recursive server).
- No mobile app wrapper — "PWA" here just means installable manifest + service worker for offline shell, not push notifications or background sync.

## Decisions

- **Serve the frontend from the same axum app** (via `tower-http::services::ServeDir`) rather than a separately deployed frontend. Rationale: keeps this a single running backend, matches "turn this into an app" (one thing to run). *Superseded in part*: the client is no longer hand-written static files — it moved to a Vite/Preact app (`webapp/`, Yarn Berry-managed) built with `yarn build` into `webapp/dist/`, which `ServeDir` now points at instead of `dns-backend/static/`. The "avoid a JS build toolchain" rationale no longer applies; the toolchain was added deliberately to make the client maintainable as it grows, while keeping the single-running-binary property (the backend still just serves a `dist/` directory, build is a separate offline step).
- **`nodeLinker: node-modules`** in `webapp/.yarnrc.yml` rather than Yarn Berry's default Plug'n'Play. Rationale: better out-of-the-box compatibility with Vite/Preact/Vite-PWA plugin resolution; PnP occasionally trips up tools that assume conventional `node_modules` resolution.
- **Keep the WebSocket protocol exactly as in the blueprint** (`{domain, record_types: [...]}` request → `{domain, results: [{record_type, records, error}]}` response) rather than one-message-per-record-type streaming. Rationale: simpler client state machine; per-record-type errors already give partial-failure visibility. Alternative (streaming one WS message per record type as it resolves) noted as an Open Question below.
- **Resolve record types concurrently within a request** using `futures::future::join_all` (or `tokio::join!`) instead of the blueprint's sequential `for` loop over `req.record_types`. Rationale: the blueprint's prose says "handle multiple record types concurrently" but the sample code resolves sequentially — fixing this discrepancy is part of turning the blueprint into a correct app.
- **API key passed as WebSocket query parameter**, matching blueprint. Rationale: `Sec-WebSocket-Protocol` header juggling adds complexity with limited benefit for a local tool. Documented as a known weakness (logged in server access logs, visible in browser history) — acceptable for local/dev use, called out in README.
- **CORS**: keep `CorsLayer::permissive()` for now since the client is same-origin when served by the backend; revisit only if a separate-origin frontend is ever added.

## Risks / Trade-offs

- [API key in query string is logged/visible] → Mitigate by documenting the tool as local-use-only in README; not a blocker for this change.
- [`hickory-resolver` 0.24 API surface may have shifted from the blueprint by the time of implementation] → Pin the version in Cargo.toml and adjust import paths during implementation if compile errors surface (e.g., `hickory-resolver::proto::rr::RecordType` path).
- [Sequential-vs-concurrent resolution fix changes behavior subtly (e.g., error ordering)] → Preserve output order matching the input `record_types` order even when resolved concurrently (use indexed futures, not just collecting as they complete).
- [Embedding static assets vs. `ServeDir` affects dev iteration speed] → Keep `ServeDir` pointing at a built `webapp/dist/` folder; embedding (e.g., via `rust-embed`) can be a later optimization, not required for this change.
- [Two-step build now required (`yarn build` before `cargo run` picks up frontend changes)] → Documented in both READMEs; `ServeDir` path resolved via `CARGO_MANIFEST_DIR` at compile time so it works regardless of the directory `cargo run` is invoked from.

## Open Questions

- Should DNS results stream back per-record-type (progressive UI updates) instead of one batched response? Deferred — batched response ships first; streaming is a possible follow-up if the UI feels sluggish for slow record types.
- Should the API key be configurable to be optional (no-auth) for pure localhost use? Left as-is (always required) to match the blueprint; can be revisited if it proves annoying in practice.
