export interface CliHints {
  dig: string;
  nslookup: string;
}

/** Shell-safe quoting for DNS names that may contain unusual characters. */
export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9._-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Strip a trailing `:port` from a resolver address used by the app/backend. */
export function stripDnsPort(resolved: string): string {
  const trimmed = resolved.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    const close = trimmed.indexOf("]");
    if (close !== -1) return trimmed.slice(0, close + 1);
  }

  const colon = trimmed.lastIndexOf(":");
  if (colon !== -1 && trimmed.indexOf(":") === colon) {
    return trimmed.slice(0, colon);
  }

  return trimmed;
}

function formatDigServer(server: string): string {
  const host = stripDnsPort(server);
  if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
  return host;
}

/** Build `dig` and `nslookup` commands that mirror a webdns lookup. */
export function formatCliHints(options: {
  recordType: string;
  domain: string;
  dnsServerResolved?: string;
}): CliHints {
  const domain = shellQuote(options.domain.trim());
  const type = options.recordType.trim().toUpperCase();
  const server = options.dnsServerResolved?.trim()
    ? formatDigServer(options.dnsServerResolved)
    : null;

  const digParts = ["dig"];
  if (server) digParts.push(`@${server}`);
  digParts.push(type, "+short", domain);

  const nslookupParts = ["nslookup", `-type=${type}`, domain];
  if (server) nslookupParts.push(server);

  return {
    dig: digParts.join(" "),
    nslookup: nslookupParts.join(" "),
  };
}
