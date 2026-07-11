# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-10

### Added

- `dns-backend` — Rust/axum WebSocket API for DNS resolution via `hickory-resolver`
- `webapp` — Vite + Preact PWA client with offline-capable shell
- Layered configuration: CLI, environment variables, TOML file, and defaults
- Separate `ip` and `port` config options (with optional `bind` override)
- Root `Makefile` with colored help and targets for webapp, backend, and `all`
- Release binary install to `dns-backend/bin/` via `make backend`
- Root `README.md` and this changelog

[0.1.0]: https://github.com/example/webdns/releases/tag/v0.1.0
