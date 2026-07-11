# webdns

Interactive DNS lookup in the browser: a Vite/Preact PWA (`webapp/`) backed by a Rust WebSocket API (`dns-backend/`).

## Quick start

```bash
make          # show available targets
make all      # build webapp + backend
make run      # build and start the server
```

The release binary is installed to `dns-backend/bin/dns-backend`. It serves the built web client from `webapp/dist/` and exposes a `/ws` endpoint for DNS queries.

Open `http://127.0.0.1:8080/` (or your configured bind address), enter the API key, and query domains.

## Project layout

| Path | Description |
|------|-------------|
| `webapp/` | Vite + Preact PWA — dev server, production bundle |
| `dns-backend/` | Rust/axum backend — WebSocket API, static file serving |
| `dns-backend/bin/` | Installed release binary (git-ignored, created by `make backend`) |
| `dns-backend/example-config/` | Sample `config.toml` |

## Configuration

Config precedence: **CLI > environment variables > TOML file > defaults**.

Copy and edit the example config:

```bash
cp dns-backend/example-config/config.toml ~/.config/webdns/config.toml
```

```toml
api_key = "super-secret-pwa-key"
ip = "127.0.0.1"
port = 8080
```

You can also set a full bind address (overrides `ip` + `port`):

```toml
bind = "0.0.0.0:9000"
```

### Environment variables

```bash
DNS_API_KEY="my-key" DNS_IP="0.0.0.0" DNS_PORT=9000 make run
```

### CLI flags

```bash
./dns-backend/bin/dns-backend --api-key my-key --ip 0.0.0.0 --port 9000
./dns-backend/bin/dns-backend --bind 0.0.0.0:9000   # overrides ip/port
```

`api_key` is required from at least one source.

## Development

**Webapp only** (proxies `/ws` to the backend):

```bash
cd webapp && yarn dev
```

**Backend** (after `yarn build` in webapp, or `make webapp`):

```bash
cd dns-backend && cargo run -- --config example-config/config.toml
```

See also [`webapp/README.md`](webapp/README.md) and [`dns-backend/README.md`](dns-backend/README.md).

## Security note

The API key is passed as a WebSocket query parameter (`?apikey=...`). Fine for local/dev use; do not expose this server publicly without TLS and stronger auth.
