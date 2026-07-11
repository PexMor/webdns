## Context

`webapp/` is a Vite + Preact PWA. `yarn build` currently emits to Vite's default `dist/`, which `webapp/.gitignore` excludes from version control. `dns-backend` serves that directory as static assets, defaulting `web_root` to `../webapp/dist` (relative to the Rust crate) — see `dns-backend/src/config.rs`.

The goal is to make a GitHub-hosted static preview possible (GitHub Pages can serve straight out of a repo's `/docs` folder on `main`), which requires the built app to live at a committed, well-known path: `docs/app/`. `docs/app/.keep` already exists as a placeholder for this.

## Goals / Non-Goals

**Goals:**
- Vite build output lands in `docs/app/` by default, with no other change to the build pipeline (icons, PWA manifest, service worker generation stay as-is).
- `dns-backend`'s default `web_root` follows the new location so a local `make run` / `cargo run` keeps working without extra flags.
- Existing overrides (`--web-root`, `DNS_WEB_ROOT`, TOML `web_root`) remain fully functional and take the same precedence as before — deployments that already pin an explicit path are unaffected.
- `docs/app/` build output is trackable in git (not gitignored), since GitHub Pages needs the files committed to serve them.

**Non-Goals:**
- Setting up GitHub Pages itself (enabling Pages in repo settings, adding a `docs/index.html` landing page, custom domain, CNAME, etc.) — out of scope for this change, which only relocates the build output.
- Adding a CI workflow that builds and commits `docs/app/` automatically — building remains a manual/local step for now.
- Changing PWA behavior, service worker scope, or manifest `start_url` semantics.

## Decisions

**Move the output via `vite.config.js` `build.outDir`, not a post-build copy step.**
Setting `build: { outDir: "../docs/app", emptyOutDir: true }` lets Vite (and `vite-plugin-pwa`'s injectManifest step, which needs to run against the final output directory) write directly to the final location in one pass. A copy/move step after `vite build` would need to duplicate Vite's own output-clearing logic and risks stale files lingering in the old `dist/` path. `emptyOutDir: true` is required because the target is outside Vite's project root (`webapp/`), which Vite refuses to auto-clean by default for safety.

**Change the backend default via the existing `default_web_root()` function, not a new config knob.**
`dns-backend/src/config.rs::default_web_root()` already computes the default relative to `CARGO_MANIFEST_DIR`. Changing `../webapp/dist` to `../docs/app` is a one-line change that flows through the existing CLI > env > file > default precedence chain untouched.

**Track `docs/app/` in git; stop ignoring build output there.**
`webapp/.gitignore` currently ignores `dist/` (build output) and `dev-dist/` (dev-mode SW cache). Since `docs/app/` must be committed for GitHub Pages, we don't add a `docs/app` ignore rule anywhere. `webapp/dist/` and `webapp/dev-dist/` stay ignored under `webapp/.gitignore` in case anything still writes there transiently (e.g. `vite preview` without a build, or a stale local build before this change lands).

**Remove `docs/app/.keep` once real output exists.**
`.keep` was only there to keep the empty directory tracked before this change; the first real build supersedes it.

## Risks / Trade-offs

- [Committing built assets bloats git history over time (binary-ish JS/CSS churn on every build)] → Accepted trade-off for now since the goal is a simple GitHub-served preview; revisit with a CI-driven Pages deploy (build artifact, not committed source) if history size becomes a problem.
- [Local `make clean` / `.gitignore` no longer cover the build output, so stale files in `docs/app/` between builds must be handled by `emptyOutDir`] → Vite's `emptyOutDir: true` clears the directory (minus `.git`) on every build, so no manual cleanup step is needed; verified this doesn't touch anything outside `docs/app/`.
- [Existing local deployments/scripts that hardcode `webapp/dist` as `--web-root` or `DNS_WEB_ROOT` keep working since only the *default* changes] → No action needed; call out in README/CHANGELOG so operators relying on the old default path are aware.

## Migration Plan

1. Update `vite.config.js`, rebuild once locally to populate `docs/app/`, delete `docs/app/.keep`.
2. Update `dns-backend` default and `config.example.toml` comment.
3. Update `Makefile`, `.gitignore` files, and docs referencing `webapp/dist`.
4. Commit the new `docs/app/` build output alongside the code changes so `main` is immediately previewable.

No rollback complexity: reverting the commit restores the old default and re-ignores `docs/app/` (after re-adding `.keep` if the directory needs to stay tracked as a placeholder).

## Open Questions

- None blocking; enabling GitHub Pages itself (repo Settings → Pages → serve from `/docs`) is a manual follow-up outside this change's scope.
