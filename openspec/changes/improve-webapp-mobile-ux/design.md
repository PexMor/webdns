## Context

`webapp/src/app.tsx` renders the record-type `<fieldset>` inline in the query form. It already has a partial fold mechanism: `autoFoldRecordTypes` (in `queryFormPrefsStore.ts`, default `false`) collapses the fieldset to a summary *after* a lookup is submitted, if enabled. The fieldset itself renders `RECORD_TYPE_GROUPS` as small native `<input type="checkbox">` elements per type (`style.css` `.record-type-option`), each ~1em square.

`webapp/src/menu.tsx`'s `SettingsPanel` has grown to include: theme, help-example layout, record display mode, explanation detail level, the fold toggle, server URL, WebSocket URL, DNS server select, a full custom-DNS-server CRUD block (add/list/import/export), API key input, and a connection-headers CRUD block — all in one scrolling panel reached from the hamburger menu's `settings` `MenuPanel`.

`dns-backend/src/main.rs` serves static assets via `tower_http::services::ServeDir` with no header customization; `dns-backend/src/config.rs` implements the project's established CLI > env > TOML > default layering pattern for every other setting.

## Goals / Non-Goals

**Goals:**
- Record type selection starts collapsed and a single setting can flip that default.
- Moving/choosing record types happens in a screen that doesn't push the domain field and results down.
- Record type controls are comfortably tappable on a phone.
- The primary Settings screen fits without heavy scrolling; rarely-touched controls move one level deeper.
- Static assets get a configurable, layered `Cache-Control: max-age` (default 600s), following the same CLI/env/TOML/default pattern as every other backend setting.

**Non-Goals:**
- No change to the WebSocket protocol, request/response shapes, or backend DNS resolution logic (other than the static-file header).
- No redesign of History, Quick Lookups, or About panels.
- No introduction of a client-side router or URL-based navigation — panel/screen state stays in-memory `useState`, consistent with the existing `Menu`/`MenuPanel` approach.
- No change to how `RECORD_TYPE_GROUPS`/`RECORD_TYPE_CONVENTION` classify types, or to the SRV/TLSA/ENUM convention-engagement logic itself — only to how/where the picker is presented.

## Decisions

### 1. Single preference drives both "starts folded" and "re-folds after submit"
Replace the existing `autoFoldRecordTypes` (default `false`, opt-in fold-after-submit) with `expandRecordTypesByDefault` (default `false`, opt-in *no-fold*). Semantics:
- `expandRecordTypesByDefault === false` (default): the record-type summary starts folded on load, and re-folds automatically after each successful submit — this is the new default behavior the proposal asks for.
- `expandRecordTypesByDefault === true`: the picker never auto-folds; the user opened the "no-fold" setting.

One boolean covers both moments (initial state and post-submit) instead of two separate toggles, matching the user's framing ("folded by default … user can set the no-fold in setting"). `queryFormPrefsStore.ts` reads the legacy `autoFoldRecordTypes` key once, if `expandRecordTypesByDefault` is absent, and writes the inverted value under the new key so existing users who had opted into the old fold-after-submit behavior land on "start folded, no-fold off" (closest equivalent), while everyone else (the common case, since the old default was `false`/no folding at all) now gets the new folded-by-default behavior. This is a one-time read-and-migrate, not a dual-key runtime dependency.

Alternative considered: keep both prefs (`foldOnLoad`, `foldAfterSubmit`) as independent toggles. Rejected — the proposal asks for one on/off "no-fold" switch, and two toggles for what's conceptually one behavior adds settings-screen clutter, working against the same proposal's goal of shrinking Settings.

### 2. Record-type picker is a new dedicated component, not a `Menu` panel
Add `RecordTypePicker.tsx`, a full-screen overlay opened from the folded summary's "Change" button, modeled visually on the existing `Menu` overlay (`.menu-overlay`/`.menu-panel` CSS, Escape-to-close, backdrop-click-to-close) but implemented as its own component rather than a new `MenuPanel` variant.

Rationale: `MenuPanel` state (`"settings" | "history" | ...`) belongs to the hamburger navigation and is owned by `app.tsx`'s `menuPanel` state, opened via the hamburger icon. The record-type picker is *form* state — it needs `selectedTypes`, `toggleType`, `isRecordTypeCheckboxDisabled`, `recordTypeTitle`, and the SRV/TLSA/ENUM engagement values that already live in `app.tsx`. Folding it into `Menu`/`MenuPanel` would require threading all of that form state into `menu.tsx` (which currently only receives already-derived, read-only summaries like `currentRecordTypes`), coupling two independently-reasoned-about pieces of state. A sibling overlay component reuses the shared CSS classes but keeps state ownership where it already is.

Alternative considered: keep the inline expand (current behavior) and just improve its styling. Rejected — an inline expand still pushes the domain field and any visible results down the page on a small viewport, which is exactly what the proposal calls out.

### 3. Chips are styled checkboxes, not custom ARIA buttons
Keep `<input type="checkbox">` as the interactive element (for native keyboard/screen-reader semantics and because `isRecordTypeCheckboxDisabled`/`disabled` already works against it), but restyle: `appearance: none` on the input, with the sibling `<label>` (currently `.record-type-help-trigger`, which today is a separate `<button>` for the help modal) reworked so the whole chip — a `min-height`/`min-width` of 44px, per WCAG 2.5.5/Apple HIG/Material touch-target guidance — is one tap target for toggling, while the record-type text remains a nested small "?"-style affordance or a distinct tap zone for help, so toggling the type and opening help don't fight over the same tap.

Alternative considered: switch to `<button type="button" aria-pressed>` chips with no underlying checkbox. Rejected — it would require re-deriving `disabled`/`title` handling and form-submission semantics (the checkboxes aren't in a `<form>`-submittable sense today since submission reads `selectedTypes` state directly, but keeping native checkboxes is strictly less code to change and keeps existing accessibility behavior intact).

### 4. Settings splits into "Settings" (primary) and "Advanced settings" (new nested panel)
Add a new `MenuPanel` value `"advanced-settings"`. `SettingsPanel` keeps: Server URL, WebSocket URL, DNS server select, the `expandRecordTypesByDefault` toggle, and a row linking to Advanced settings. A new `AdvancedSettingsPanel` component holds: color theme, help-example layout, record display mode, explanation detail level, custom DNS server management (add/list/import/export), API key, and connection headers management — everything that's set once during initial configuration and rarely touched afterward.

Back-navigation: Advanced settings' back button returns to `"settings"` (not the root menu), so the user doesn't lose their place; Settings' back button continues to return to the root menu as today. This means `onOpenPanel` calls need a small amount of panel-aware back targets rather than every panel unconditionally going back to `null`.

Alternative considered: an accordion/collapsible-sections layout within the single Settings panel instead of a second screen. Rejected — collapsible sections still require scrolling past collapsed headers to reach later ones and don't reduce the DOM/visual weight of the first screen the way a separate screen does; the proposal explicitly asks for "deeper screen."

### 5. Backend cache header via a scoped `tower-http` layer, not a global one
Add `static_cache_seconds: u64` to `AppConfig` (CLI `--static-cache-seconds`, env `DNS_STATIC_CACHE_SECONDS`, TOML `static_cache_seconds`, default `600`), resolved with the same `resolve_*` layering helpers already in `config.rs`. Apply `tower_http::set_header::SetResponseHeaderLayer::overriding(CACHE_CONTROL, <precomputed HeaderValue>)` wrapped *only* around the `ServeDir` service passed to `.fallback_service(...)`, via `tower::ServiceBuilder` (requires adding the `tower` crate and the `set-header` feature on `tower-http`).

Rationale for scoping the layer to `ServeDir` only, rather than `app.layer(...)` on the whole router: `/version` already sets `Cache-Control: no-store` deliberately (per `dns-web-client`'s identity-proxy session-probe requirement) and `/ws` is not an HTTP-cacheable response at all; a router-wide layer would either conflict with or need to special-case those routes. Scoping to the static-file service avoids touching that existing, intentional behavior.

Alternative considered: set the header from within a custom static-file handler instead of `ServeDir`. Rejected — `ServeDir` already handles conditional requests (ETag/If-Modified-Since), range requests, and correct content-types; reimplementing that to inject one header would be a large regression in behavior for no benefit over layering.

## Risks / Trade-offs

- [Risk] Renaming/inverting the `autoFoldRecordTypes` preference key could confuse users who don't notice the changed default. → Mitigation: one-time migration reads the old key (see Decision 1) so an explicit prior choice carries forward as closely as the new single-toggle model allows; this is a low-traffic personal-use tool so a settings-behavior note in the PR description is sufficient beyond the migration itself.
- [Risk] Larger chip touch targets in a wrapping flex layout (`.record-type-group__options`) may require more vertical space per group, partially offsetting the "less scrolling" goal on very small screens. → Mitigation: the fold-by-default change means this layout is only visible when the user deliberately opens the picker screen, which has the whole viewport to itself (not competing with the domain field/results for space).
- [Risk] A backend cache `max-age` means an updated `index.html`/JS bundle after a deploy may not be picked up by a client for up to the configured duration. → Mitigation: default stays modest (10 minutes, per the proposal), it's operator-configurable down to 0 for environments that redeploy frequently, and this only affects the static asset service, not `/version` (still `no-store`, usable as a fresh-deploy probe) or `/ws`.

## Migration Plan

1. Ship the backend cache-header change and config option (additive, backward compatible — no existing config keys change meaning).
2. Ship the webapp preference migration (`autoFoldRecordTypes` → `expandRecordTypesByDefault`) alongside the new fold-by-default behavior and picker screen in the same release, so users don't pass through an intermediate state with the old key but new UI.
3. No rollback concerns beyond normal revert — no server-side data migrations, no schema changes to the WebSocket protocol.

## Open Questions

- Exact chip color/spacing treatment is a visual-design detail to finalize during implementation/review rather than block the proposal on.
