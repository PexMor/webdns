## Context

`webapp/src/` (Preact + Vite PWA) has 17 files: `.jsx` components (`app.jsx`, `main.jsx`, `menu.jsx`, `RecordResultCard.jsx`, `RecordTypeHelpModal.jsx`) and `.js` stores/utilities (`wsHeaderStore.js`, `themeStore.js`, `dnsServerStore.js`, `loadConfig.js`, `quickLookupStore.js`, `recordTypes.js`, `webdnsDb.js`, `lookupHistoryStore.js`, `apiKeyStore.js`, `lookupFormStore.js`, `useDnsSocket.js`, `recordTypeHelp.js`, `formatRecordResult.js`, `displayPrefsStore.js`). There is no `tsconfig.json` or `typescript` devDependency today; the build uses `@preact/preset-vite` (Babel-based) with no type checking. `webdnsDb.js` wraps Dexie (IndexedDB), `useDnsSocket.js` owns the WebSocket connection and the DNS query/response message shapes, and `recordTypes.js`/`recordTypeHelp.js` define the DNS record type vocabulary shared across components and stores.

## Goals / Non-Goals

**Goals:**
- Convert every `.jsx`/`.js` file in `webapp/src/` to `.tsx`/`.ts` with meaningful (non-`any`) types for component props, store state/actions, the Dexie schema, and WebSocket request/response payloads.
- Add `typescript` + `tsconfig.json` and wire a type-check step (`tsc --noEmit`) into `yarn build` (and optionally a standalone `yarn typecheck` script) so type errors fail CI/build, not just the editor.
- Preserve current runtime behavior and UI exactly — this is a source/tooling migration, not a refactor of logic.

**Non-Goals:**
- No changes to component behavior, styling, DNS protocol, or backend.
- No introduction of strict/advanced TS patterns (branded types, io-ts/zod runtime validation) beyond what's needed for compile-time safety — keep it idiomatic Preact/TS.
- No test framework changes (Playwright config is untouched beyond adjusting any imports if they reference renamed files).

## Decisions

- **tsconfig target**: Use `"jsx": "react-jsx"` with `"jsxImportSource": "preact"` (matches `@preact/preset-vite`'s existing Babel JSX pragma handling), `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"strict": true`, `"noEmit": true` (Vite/esbuild does the actual transpilation; `tsc` is used only for type-checking). Alternative considered: `allowJs` incremental migration — rejected because the user asked for a complete migration, and the codebase is small enough (17 files) to convert in one pass.
- **Renaming order**: Convert leaf modules with no local imports first (`recordTypes.js`, `recordTypeHelp.js`, `formatRecordResult.js`, `webdnsDb.js`), then stores that depend on them (`wsHeaderStore`, `themeStore`, `dnsServerStore`, `apiKeyStore`, `lookupFormStore`, `lookupHistoryStore`, `quickLookupStore`, `displayPrefsStore`, `loadConfig`), then hooks (`useDnsSocket.js`), then components (`RecordResultCard.jsx`, `RecordTypeHelpModal.jsx`, `menu.jsx`, `app.jsx`, `main.jsx`). This lets each file's new types inform the types of its dependents rather than guessing top-down.
- **Shared types location**: Define shared domain types (record type enum/union, DNS query/response message shapes, connection header shape, Dexie row types) in a new `webapp/src/types.ts` rather than scattering `interface`/`type` declarations per-file, since `recordTypes.js`, `useDnsSocket.js`, `webdnsDb.js`, and multiple components/stores all need the same shapes today. Alternative considered: colocate types with their primary owning module — rejected because the WebSocket message shape and record-type union are genuinely cross-cutting and colocating would create import cycles between stores and the hook.
- **Preact typing**: Use `preact/compat`-free typing (`ComponentChildren`, `JSX.Element` from `preact`) since the project doesn't depend on `preact/compat`; import prop types directly from `preact`.
- **Store typing pattern**: Existing stores use a plain module-level mutable-state + subscriber-callback pattern (not a library like nanostores/zustand). Type each store's public API explicitly (state shape, getter, setter/action signatures, subscribe function) rather than introducing a new state-management dependency.
- **Build enforcement**: Add `"typecheck": "tsc --noEmit"` script and run it as part of `"build": "tsc --noEmit && vite build"` (prepended) so `yarn build` fails on type errors, matching the new `webapp-type-safety` capability requirement. `yarn dev` stays type-check-free for fast iteration (editor/IDE surfaces errors live).

## Risks / Trade-offs

- [Risk] Dexie's typed API (`Table<T, K>`) requires explicit schema typing in `webdnsDb.js` → could mismatch actual stored shape if migrations weren't tracked carefully → Mitigation: type each Dexie table from the existing `.stores()` schema string and cross-check against actual read/write call sites during conversion.
- [Risk] `.jsx`/`.js` → `.tsx`/`.ts` renames change file extensions that other files import without extensions (`import X from "./foo"`), and Vite/TS resolution differences could break resolution → Mitigation: Vite + `moduleResolution: "Bundler"` resolves extensionless imports across `.ts`/`.tsx` the same way; verify with `yarn dev` and `yarn build` after each batch of renames.
- [Risk] `strict: true` surfaces latent nullability bugs (e.g., `undefined` DOM refs, optional WebSocket fields) that currently work by luck → Mitigation: fix them as part of migration rather than suppressing with `any`/`!`; flag any suspicious runtime-consequential ones in the PR description for review.
- [Trade-off] Doing the full migration in one change (vs. `allowJs` incremental) is a larger single PR, but avoids a long-lived mixed-JS/TS state and matches the explicit "completely" migrate request.

## Migration Plan

1. Add `typescript` devDependency and `tsconfig.json`; add `typecheck` script (build still passes since no `.ts` files exist yet — `tsc --noEmit` on zero files is a no-op).
2. Convert files bottom-up per the ordering in Decisions, one file (or tightly-coupled pair) per step, running `yarn dev` after each to catch resolution/runtime issues early.
3. Update `webapp/index.html` script `src` and `webapp/vite.config.js` (no changes expected beyond the entry file extension, since Vite resolves `main.tsx` automatically if `index.html` references `/src/main.tsx`).
4. Wire `tsc --noEmit` into `yarn build`; run `yarn build` and fix any remaining type errors.
5. Manually smoke-test the app (`yarn dev`) covering: DNS lookup submission, results display (success + error record types), connection status states, hamburger menu, settings/DNS server management, quick lookups, and history — since this migration touches every source file.

Rollback: revert the change's commits; no data migrations or backend changes are involved, so rollback is a pure source-tree revert.

## Open Questions

- None — scope is bounded to `webapp/src/` and build config; no backend or spec-visible behavior is affected.
