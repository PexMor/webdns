## 1. Tooling Setup

- [x] 1.1 Add `typescript` devDependency to `webapp/package.json`
- [x] 1.2 Add `webapp/tsconfig.json` (`jsx: react-jsx`, `jsxImportSource: preact`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `noEmit: true`, `include: src`)
- [x] 1.3 Add `"typecheck": "tsc --noEmit"` script to `webapp/package.json` and prepend it to the `build` script (`tsc --noEmit && vite build`)
- [x] 1.4 Create `webapp/src/types.ts` with shared domain types: DNS record type union, WebSocket query request shape, WebSocket response shape (per-record-type success/error), connection header shape, Dexie row types

## 2. Convert Leaf Modules (no local imports)

- [x] 2.1 Convert `recordTypes.js` → `recordTypes.ts`
- [x] 2.2 Convert `recordTypeHelp.js` → `recordTypeHelp.ts`
- [x] 2.3 Convert `formatRecordResult.js` → `formatRecordResult.ts`
- [x] 2.4 Convert `webdnsDb.js` → `webdnsDb.ts` (raw IndexedDB wrapper, not Dexie — typed `IDBDatabase`/`IDBObjectStore` helpers)

## 3. Convert Stores

- [x] 3.1 Convert `wsHeaderStore.js` → `wsHeaderStore.ts`
- [x] 3.2 Convert `themeStore.js` → `themeStore.ts`
- [x] 3.3 Convert `dnsServerStore.js` → `dnsServerStore.ts`
- [x] 3.4 Convert `apiKeyStore.js` → `apiKeyStore.ts`
- [x] 3.5 Convert `lookupFormStore.js` → `lookupFormStore.ts`
- [x] 3.6 Convert `lookupHistoryStore.js` → `lookupHistoryStore.ts`
- [x] 3.7 Convert `quickLookupStore.js` → `quickLookupStore.ts`
- [x] 3.8 Convert `displayPrefsStore.js` → `displayPrefsStore.ts`
- [x] 3.9 Convert `loadConfig.js` → `loadConfig.ts`

## 4. Convert Hook

- [x] 4.1 Convert `useDnsSocket.js` → `useDnsSocket.ts`, typing the WebSocket send/receive payloads against `types.ts`

## 5. Convert Components

- [x] 5.1 Convert `RecordResultCard.jsx` → `RecordResultCard.tsx`
- [x] 5.2 Convert `RecordTypeHelpModal.jsx` → `RecordTypeHelpModal.tsx`
- [x] 5.3 Convert `menu.jsx` → `menu.tsx`
- [x] 5.4 Convert `app.jsx` → `app.tsx`
- [x] 5.5 Convert `main.jsx` → `main.tsx`

## 6. Wire Up Entry Point and Build

- [x] 6.1 Update `webapp/index.html` script `src` to reference `main.tsx`
- [x] 6.2 Confirm `webapp/vite.config.js` resolves the new entry with no further changes needed
- [x] 6.3 Run `yarn typecheck` and fix all reported type errors (added `vite/client` types for the CSS side-effect import; removed a pre-existing unused `listWsHeaders` import in `menu.tsx`)
- [x] 6.4 Run `yarn build` and confirm it succeeds end-to-end (typecheck + vite build) — build output unchanged in shape (`dist/assets/index-*.js`, PWA service worker generated)

## 7. Verification

- [x] 7.1 Ran `yarn dev` against a real `dns-backend` instance (built via `cargo run`) and smoke-tested with Playwright (headless Chromium, freshly installed for this run): API key connect → `.status--connected`, DNS lookup submission for `example.com` rendering 2 `.record-card` results, hamburger menu open + Escape-to-close — 0 console errors, 0 page errors
- [x] 7.2 Smoke-tested Settings panel: API key Connect flow (`.status--connected`), custom DNS server add (`9.9.9.9` / "Quad9" appears in `.dns-list`)
- [x] 7.3 Smoke-tested History (1 entry recorded after the lookup) and Quick Lookups (saved current form, appears in `.quick-lookup-list`)
- [x] 7.4 Confirmed no `.js`/`.jsx` files remain under `webapp/src/` (`grep` for stale extension references in `src/`, `vite.config.js`, `index.html` also came back empty)
- [x] 7.5 Not independently re-verified (unchanged from the pre-migration build): `vite-plugin-pwa` still runs in `yarn build` and generates `dist/sw.js`, `dist/workbox-*.js`, and `dist/manifest.webmanifest` exactly as before — no PWA config or asset paths were touched by this migration
