# webapp

Vite + Preact web client for `dns-backend`, managed with Yarn Berry (v4) via Corepack.

## Setup

Corepack ships with Node and reads the `packageManager` field in `package.json`, so no global Yarn install is needed:

```
corepack enable   # once per machine, if not already done
yarn install
```

## Development

```
yarn dev
```

Runs Vite's dev server with a `/ws` proxy to `ws://127.0.0.1:8080` (the default `dns-backend` bind address). Start `dns-backend` separately while developing.

## Build

```
yarn build
```

Outputs the production bundle to `dist/`, which `dns-backend` serves directly (see `../dns-backend/README.md`).

```
yarn preview
```

Serves the built `dist/` locally for a production-like check without the Rust backend.

## Structure

- `src/app.tsx` — main UI: API key panel, query form, results list, connection status.
- `src/useDnsSocket.ts` — WebSocket connection + DNS query hook.
- `vite-plugin-pwa` generates the manifest and service worker at build time (see `vite.config.js`).
