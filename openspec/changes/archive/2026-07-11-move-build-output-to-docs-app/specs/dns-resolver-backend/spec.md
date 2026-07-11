## ADDED Requirements

### Requirement: Static Web Asset Directory Default
The backend SHALL default the static web asset directory (`web_root`) to `../docs/app` (relative to the backend crate) when no override is supplied. This default MAY be overridden, with the same precedence as other layered configuration (CLI `--web-root` > `DNS_WEB_ROOT` environment variable > `web_root` in the TOML config file > built-in default).

#### Scenario: No web_root override configured
- **WHEN** the server starts with no `--web-root` CLI flag, no `DNS_WEB_ROOT` environment variable, and no `web_root` key in the TOML config file
- **THEN** the server serves static assets from `../docs/app` relative to the backend crate

#### Scenario: Explicit web_root override still takes precedence
- **WHEN** the server starts with `--web-root /var/www/webdns` (or `DNS_WEB_ROOT`, or a TOML `web_root` entry)
- **THEN** the server serves static assets from the overridden path instead of `../docs/app`

#### Scenario: Configured web_root directory does not exist
- **WHEN** `serve_web` is enabled and the resolved `web_root` directory does not exist on disk
- **THEN** the server logs a warning identifying the missing path and continues starting, so that static files return 404 until the directory is present
