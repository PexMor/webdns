# dns-backend

A small Rust app: an async WebSocket backend (axum + hickory-resolver) that resolves DNS records, plus a bundled web client (Vite/Preact PWA, in `../webapp/`) served from the same binary.

## Running

Build the web client first (see [`../webapp/README.md`](../webapp/README.md)):

```
cd ../webapp && yarn build
```

Then run the server, which serves `../webapp/dist/` as its static assets:

```
cargo run
```

Config is loaded with precedence **CLI > environment variables > TOML file > built-in defaults**.

### Config file

By default the server looks for `~/.config/webdns/config.toml` (or `$XDG_CONFIG_HOME/webdns/config.toml`). You can also point at an explicit file:

```
cargo run -- --config example-config/config.toml
```

Example `config.toml` (see `example-config/config.toml`):

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

```
DNS_API_KEY="envkey" DNS_IP="0.0.0.0" DNS_PORT=9000 cargo run
DNS_API_KEY="envkey" DNS_BIND_ADDR="127.0.0.1:9000" cargo run
```

### CLI flags

```
cargo run -- --api-key clikey --ip 0.0.0.0 --port 9000
cargo run -- --api-key clikey --bind 0.0.0.0:9000
```

From the project root, `make backend` builds the webapp, compiles the release binary, and installs it to `bin/dns-backend`.

`api_key` is required from at least one source; the server fails to start with a clear error if it's missing everywhere.

## Using the app

1. Build the web client and start the server (see above).
2. Open `http://<bind-address>/` in a browser — this serves the built web client from `../webapp/dist/`.
3. Enter the configured API key in the "API key" field and click **Connect**.
4. Enter a domain, pick record types, and submit the form to query DNS records over the `/ws` WebSocket endpoint.

The client can be installed as a PWA (installable app icon, offline-loading shell) via the browser's install prompt.

## Notes

- The API key is passed as a WebSocket query parameter (`?apikey=...`). This is fine for local/dev use but is visible in logs and browser history — do not expose this server to the public internet without adding proper transport security and a stronger auth scheme.
- DNS resolution uses Cloudflare's public resolvers (`1.1.1.1` / `1.0.0.1`) via `hickory-resolver`, not the OS resolver.
