## Why

The webapp currently builds to `webapp/dist/`, which is gitignored and only exists locally or in CI build artifacts. To let anyone preview the built PWA straight from GitHub (e.g. via GitHub Pages serving `/docs`), the build output needs to land in a tracked, predictable path — `docs/app/` — and the backend's default static-file root needs to follow it.

## What Changes

- Change the Vite build output directory for `webapp` from `dist/` to `../docs/app/` (`vite.config.js` `build.outDir`).
- Untrack `webapp/dist/` from `.gitignore` handling and instead track `docs/app/` as committed build output; add a `.gitignore` rule so the previous `webapp/dist/` local artifact is still ignored if it reappears (e.g. `vite preview` caches).
- Update `dns-backend`'s default `web_root` from `../webapp/dist` to `../docs/app`, preserving existing CLI/env/config-file override precedence (`--web-root`, `DNS_WEB_ROOT`, `web_root` in TOML).
- Update root `Makefile` (`webapp`, `clean` targets) and documentation (`README.md`, `webapp/README.md`, `dns-backend/README.md`, `docs/cloudflare-tunnel.md`, `dns-backend/config.example.toml`) to reference `docs/app/` instead of `webapp/dist/`.
- Remove the placeholder `docs/app/.keep` once real build output lands there.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `dns-resolver-backend`: the default static web asset directory (`web_root`) changes from `../webapp/dist` to `../docs/app`, with the same override precedence.

## Impact

- Affected code: `webapp/vite.config.js`, `dns-backend/src/config.rs`, `dns-backend/config.example.toml`, root `Makefile`.
- Affected docs: `README.md`, `webapp/README.md`, `dns-backend/README.md`, `docs/cloudflare-tunnel.md`.
- Affected config: `.gitignore` (root and/or `webapp/.gitignore`) to track `docs/app/` build output instead of ignoring it.
- No API or protocol changes; existing `--web-root` / `DNS_WEB_ROOT` / TOML `web_root` overrides continue to work unchanged for deployments that already pin an explicit path.
