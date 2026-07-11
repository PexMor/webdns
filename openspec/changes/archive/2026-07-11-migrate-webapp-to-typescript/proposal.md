## Why

`webapp/src/` is currently plain JavaScript/JSX with no static type checking, so prop shapes, WebSocket message contracts, and store APIs (dexie tables, localStorage-backed stores) are only verified at runtime or by manual review. Migrating to TypeScript/TSX catches type mismatches at build time and documents the data contracts (DNS query/response shapes, record types, connection headers) directly in code.

## What Changes

- Add TypeScript tooling to the webapp (`typescript`, a `tsconfig.json`, and type-checking wired into the dev/build scripts).
- Rename all `.jsx` files under `webapp/src/` to `.tsx` and all `.js` files to `.ts`, adding type annotations (component props, store state, WebSocket message payloads, Dexie schema, DNS record/result shapes).
- Update `webapp/vite.config.js` and `webapp/index.html`/entry references as needed to point at the renamed `main.tsx` entry point.
- Add shared TypeScript types/interfaces for DNS record types, query/response WebSocket messages, connection headers, and store shapes, replacing the informal shapes implied by `recordTypes.js` and `recordTypeHelp.js`.
- **BREAKING**: none for end users — this is a source-level/build-time change only; the built app's runtime behavior and UI are unchanged.

## Capabilities

### New Capabilities

- `webapp-type-safety`: The webapp source SHALL be authored in TypeScript/TSX with static type checking enforced as part of the build, so type errors are caught before code ships.

### Modified Capabilities

(none — no user-facing/runtime requirement changes; `dns-web-client`, `lookup-history`, `quick-lookups`, `webapp-dns-server-prefs`, `webapp-runtime-config`, and `ws-connection-headers` behavior is preserved as-is)

## Impact

- Affected code: all files in `webapp/src/` (9 `.jsx`/`.js` component and store files, plus `main.jsx`), `webapp/vite.config.js`, `webapp/package.json` (new `typescript` devDependency, updated scripts), and `webapp/index.html` (script `src` entry).
- Build/dev tooling: `vite dev`/`vite build` must type-check (or a separate `tsc --noEmit` step is added) so type errors surface before merge.
- No backend, API, or WebSocket protocol changes; no changes to `openspec/specs/*` requirements.
