## Why

The DNS query form and Settings panel were built out incrementally and have accumulated friction on phones: the record-type checklist is always expanded and pushes lookup results off-screen, its native checkboxes are too small to hit reliably with a finger, and the Settings panel now has enough controls (theme, display prefs, server/DNS selection, custom servers, API key, connection headers) that it requires significant scrolling to reach anything below the fold. Static web assets are also served with no caching headers at all, so every page load re-fetches unchanged JS/CSS/icons.

## What Changes

- Record type selection collapses to a compact summary by default (instead of always expanded); a new Settings toggle lets the user keep it expanded ("no-fold") instead.
- Record type selection moves out of the inline form into a dedicated full-screen picker (reachable from the collapsed summary), so choosing types no longer pushes the domain input and results down the page.
- Record type controls are restyled as large tappable chips/toggle buttons (≥44px touch target) instead of native checkboxes, for reliable mobile tapping.
- The Settings panel is split into a short primary screen (server URL, WebSocket URL, DNS server, record-type fold preference) and a new "Advanced settings" sub-screen (theme, display/detail preferences, custom DNS server management, API key, connection headers) reachable from the primary screen, cutting the primary screen's scroll length.
- The backend serves static web assets with a configurable `Cache-Control: max-age=<seconds>` header (CLI/env/TOML layered, default 600 seconds / 10 minutes) instead of no caching headers.

## Capabilities

### New Capabilities
(none — this change reshapes existing UI/behavior rather than introducing new domains)

### Modified Capabilities
- `dns-web-client`: `DNS Query Form` requirement gains default-folded record type selection, a dedicated record-type picker screen, and larger touch-friendly controls; `Settings Panel` requirement is split into primary and advanced screens.
- `dns-resolver-backend`: `Static Web Asset Directory Default` requirement gains a configurable cache-control max-age for served static assets.

## Impact

- `webapp/src/app.tsx`, `webapp/src/menu.tsx`, `webapp/src/style.css`, `webapp/src/queryFormPrefsStore.ts` (webapp UI and prefs storage)
- `dns-backend/src/main.rs`, `dns-backend/src/config.rs` (static file serving headers and new config option)
- No wire-protocol or WebSocket message changes; no breaking changes to existing stored preferences (new keys default to preserving today's effective behavior where reasonable).
