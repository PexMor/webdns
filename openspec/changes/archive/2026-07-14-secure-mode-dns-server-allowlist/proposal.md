## Why

The backend currently resolves every query against whatever `dns_server` the client (webapp/frontend) supplies, with no server-side restriction. In deployments where the operator wants to guarantee that only a known, trusted set of upstream resolvers is ever used — for example to prevent DNS exfiltration, SSRF-style probing of internal/arbitrary IPs via the resolver, or unvetted upstreams being queried on the operator's behalf — there is no way to lock the backend down to an approved list of DNS servers.

## What Changes

- Add a `secure_mode` configuration flag (CLI `--secure-mode`, env `DNS_SECURE_MODE`, TOML `secure_mode`), defaulting to `false` (current, unrestricted behavior).
- Add an `allowed_dns_servers` configuration list (CLI `--allowed-dns-server` repeatable flag, env `DNS_ALLOWED_DNS_SERVERS` comma-separated, TOML `allowed_dns_servers` array of IP strings) that defines the set of upstream DNS servers permitted when `secure_mode` is enabled.
- **BREAKING (secure_mode only)**: When `secure_mode` is `true`, the backend SHALL reject (with a JSON error response over the WebSocket, connection kept open) any request whose `dns_server` is not present in `allowed_dns_servers`. It SHALL NOT silently fall back to a default resolver or ignore the requested value.
- When `secure_mode` is `true` and no `dns_server` is supplied by the client, the backend uses the first entry of `allowed_dns_servers` as the default, instead of the hardcoded `1.1.1.1`.
- Fail fast at startup if `secure_mode` is `true` but `allowed_dns_servers` is empty, since that configuration can never serve a successful query.
- Log the resolved `secure_mode` and `allowed_dns_servers` values at startup, consistent with existing config reporting.
- When `secure_mode` is `false`, behavior is unchanged: any syntactically valid IP address is accepted as `dns_server`.

## Capabilities

### Modified Capabilities
- `dns-resolver-backend`: adds `secure_mode` / `allowed_dns_servers` layered configuration, and changes per-request DNS server selection to enforce the allowlist and reject/report disallowed servers when secure mode is active.

## Impact

- `dns-backend/src/config.rs`: new `secure_mode` and `allowed_dns_servers` fields on `AppConfig`, CLI args, env vars, TOML keys, startup validation, and logging.
- `dns-backend/src/dns.rs`: `ResolverCache::get` (or its caller) gains allowlist enforcement when secure mode is active; default-server selection changes in secure mode.
- `dns-backend/src/ws.rs`: no interface change expected, but the error path for a disallowed `dns_server` reuses the existing "invalid dns_server" JSON error response shape.
- No frontend/webapp changes required; the webapp already sends whatever `dns_server` the user configured and already handles server-returned errors.
