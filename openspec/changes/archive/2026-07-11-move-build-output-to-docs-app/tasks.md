## 1. Webapp build output

- [x] 1.1 In `webapp/vite.config.js`, add `build: { outDir: "../docs/app", emptyOutDir: true }` to `defineConfig`.
- [x] 1.2 In `webapp/.gitignore`, keep `dist/` and `dev-dist/` ignored (transient local artifacts); confirm no rule ignores `docs/app`.
- [x] 1.3 Run `yarn build` in `webapp/` and confirm output lands in `docs/app/` (manifest, service worker, assets, `config.json`, `icons/`).
- [x] 1.4 Delete `docs/app/.keep` now that real build output exists there.

## 2. Backend default web root

- [x] 2.1 In `dns-backend/src/config.rs`, change `default_web_root()` from `../webapp/dist` to `../docs/app`.
- [x] 2.2 Update the comment in `dns-backend/config.example.toml` describing the default `web_root`.
- [x] 2.3 Run the backend locally with no `--web-root`/`DNS_WEB_ROOT`/TOML override and confirm it serves the app from `docs/app/` (e.g. `curl` the root path returns `index.html`).

## 3. Build scripts and tooling

- [x] 3.1 In root `Makefile`, update the `webapp` target's echo/comments referencing `webapp/dist` to `docs/app`.
- [x] 3.2 In root `Makefile`, update the `clean` target to remove `docs/app/*` (excluding `.gitkeep`/`.keep` if reintroduced) instead of `$(WEBAPP_DIR)/dist`, keeping `$(WEBAPP_DIR)/dev-dist` removal as-is.

## 4. Documentation

- [x] 4.1 Update `README.md` reference to `webapp/dist/` → `docs/app/`.
- [x] 4.2 Update `webapp/README.md` build/preview sections referencing `dist/`.
- [x] 4.3 Update `dns-backend/README.md` references to `../webapp/dist/`.
- [x] 4.4 Update `docs/cloudflare-tunnel.md` reference to `webapp/dist/config.json`.

## 5. Verification

- [x] 5.1 Run `make webapp` from repo root and confirm `docs/app/` is populated and `webapp/dist/` is not created.
- [x] 5.2 Run `make run` (or `make backend-native` + run the binary) and confirm the PWA loads at the backend's bind address with no `--web-root` override.
- [x] 5.3 Run `git status` to confirm `docs/app/` build output is tracked (not gitignored) and `webapp/dist/` no longer appears.
