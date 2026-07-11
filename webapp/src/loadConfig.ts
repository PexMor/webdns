import type { DnsServerConfigEntry, DnsServerOption, RuntimeConfig, WsHeader } from "./types";

const WS_URL_KEY = "dns_ws_url";
const HTTP_SERVER_URL_KEY = "dns_http_server_url";
const DNS_SERVER_KEY = "dns_server_address";

export const DEFAULT_CONFIG: RuntimeConfig = {
  wsUrls: ["/ws"],
  dnsServers: [
    { label: "Google Primary", address: "8.8.8.8" },
    { label: "Google Secondary", address: "8.8.4.4" },
    { label: "Cloudflare", address: "1.1.1.1" },
    { label: "Local API Server", address: "auto" },
  ],
  wsConnectionHeaders: [],
  wsHeaderQueryMap: {},
};

interface ConfigHeaderInput {
  name?: string;
  value?: string;
  enabled?: boolean;
}

function normalizeConfigHeader(entry: ConfigHeaderInput): WsHeader | null {
  if (!entry?.name) return null;
  return {
    name: String(entry.name).trim(),
    value: String(entry.value ?? ""),
    enabled: entry.enabled !== false,
    fromConfig: true,
  };
}

export function deriveWsUrlFromHttp(httpUrl: string): string | null {
  const trimmed = httpUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  let path = url.pathname.replace(/\/$/, "") || "";
  if (!path.endsWith("/ws")) {
    path = `${path}/ws`;
  }

  return `${wsProtocol}//${url.host}${path}`;
}

export function isValidHttpServerUrl(value: string): boolean {
  return Boolean(deriveWsUrlFromHttp(value));
}

export function resolveWsUrl(entry: string): string | null {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return deriveWsUrlFromHttp(entry);
  }
  if (entry.startsWith("ws://") || entry.startsWith("wss://")) {
    return entry;
  }
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const path = entry.startsWith("/") ? entry : `/${entry}`;
  return `${protocol}://${location.host}${path}`;
}

export function resolveAutoDnsHost(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    const host = url.hostname;
    if (!host || host === "localhost") return "127.0.0.1";
    return host;
  } catch {
    return "127.0.0.1";
  }
}

export function resolveDnsAddress(address: string, wsUrl: string): string {
  if (address === "auto") return resolveAutoDnsHost(wsUrl);
  return address;
}

function isValidConfig(data: unknown): data is {
  wsUrls: string[];
  dnsServers: DnsServerConfigEntry[];
  wsConnectionHeaders?: unknown;
  wsHeaderQueryMap?: unknown;
} {
  const d = data as Record<string, unknown> | null;
  return Boolean(
    d &&
      Array.isArray(d.wsUrls) &&
      Array.isArray(d.dnsServers) &&
      d.dnsServers.every(
        (s) => s && typeof (s as DnsServerConfigEntry).address === "string"
      )
  );
}

export async function loadConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch("/config.json");
    if (!res.ok) throw new Error("fetch failed");
    const data: unknown = await res.json();
    if (!isValidConfig(data)) throw new Error("invalid schema");
    const wsConnectionHeaders = Array.isArray(data.wsConnectionHeaders)
      ? (data.wsConnectionHeaders as ConfigHeaderInput[])
          .map(normalizeConfigHeader)
          .filter((header): header is WsHeader => header !== null)
      : [];
    const wsHeaderQueryMap =
      data.wsHeaderQueryMap && typeof data.wsHeaderQueryMap === "object"
        ? (data.wsHeaderQueryMap as Record<string, string>)
        : {};

    return {
      wsUrls: data.wsUrls.length ? data.wsUrls : DEFAULT_CONFIG.wsUrls,
      dnsServers: data.dnsServers.length ? data.dnsServers : DEFAULT_CONFIG.dnsServers,
      wsConnectionHeaders,
      wsHeaderQueryMap,
    };
  } catch {
    return {
      wsUrls: [...DEFAULT_CONFIG.wsUrls],
      dnsServers: DEFAULT_CONFIG.dnsServers.map((s) => ({ ...s })),
      wsConnectionHeaders: [],
      wsHeaderQueryMap: {},
    };
  }
}

export function buildWsUrlWithHeaders(
  baseUrl: string,
  headers: WsHeader[],
  queryMap: Record<string, string> = {}
): string {
  const url = new URL(baseUrl);

  for (const header of headers) {
    if (!header?.enabled) continue;
    if (!header.name || !header.value) continue;

    const paramName =
      queryMap[header.name] ??
      (header.name.toLowerCase() === "apikey" ? "apikey" : header.name.toLowerCase());
    url.searchParams.set(paramName, header.value);
  }

  return url.toString();
}

export function mergeHeaderSuggestions(
  storedHeaders: WsHeader[],
  configHeaders: WsHeader[]
): WsHeader[] {
  if (storedHeaders.length > 0) {
    return storedHeaders;
  }
  return configHeaders.map((header) => ({ ...header, suggestion: true }));
}

export function getResolvedWsUrls(wsUrls: string[]): string[] {
  return wsUrls.map(resolveWsUrl).filter((url): url is string => url !== null);
}

export function buildDnsServerOptions(
  configServers: DnsServerConfigEntry[],
  customServers: DnsServerConfigEntry[],
  wsUrl: string
): DnsServerOption[] {
  const seen = new Set<string>();
  const options: DnsServerOption[] = [];

  for (const entry of configServers) {
    const resolvedAddress = resolveDnsAddress(entry.address, wsUrl);
    if (seen.has(resolvedAddress)) continue;
    seen.add(resolvedAddress);
    options.push({
      label: entry.label || entry.address,
      address: entry.address,
      resolvedAddress,
      custom: false,
    });
  }

  for (const entry of customServers) {
    const resolvedAddress = resolveDnsAddress(entry.address, wsUrl);
    if (seen.has(resolvedAddress)) continue;
    seen.add(resolvedAddress);
    options.push({
      label: entry.label || entry.address,
      address: entry.address,
      resolvedAddress,
      custom: true,
    });
  }

  return options;
}

export function getStoredWsUrl(): string | null {
  return localStorage.getItem(WS_URL_KEY);
}

export function setStoredWsUrl(url: string): void {
  localStorage.setItem(WS_URL_KEY, url);
}

export function getStoredHttpServerUrl(): string {
  return localStorage.getItem(HTTP_SERVER_URL_KEY) ?? "";
}

export function setStoredHttpServerUrl(url: string): void {
  if (url) {
    localStorage.setItem(HTTP_SERVER_URL_KEY, url);
  } else {
    localStorage.removeItem(HTTP_SERVER_URL_KEY);
  }
}

export function getStoredDnsServer(): string | null {
  return localStorage.getItem(DNS_SERVER_KEY);
}

export function setStoredDnsServer(address: string): void {
  localStorage.setItem(DNS_SERVER_KEY, address);
}

export function pickInitialWsUrl(
  resolvedUrls: string[],
  httpServerUrl: string = getStoredHttpServerUrl()
): string {
  const derived = deriveWsUrlFromHttp(httpServerUrl);
  if (derived) {
    const stored = getStoredWsUrl();
    if (stored && (resolvedUrls.includes(stored) || stored === derived)) return stored;
    return derived;
  }

  const stored = getStoredWsUrl();
  if (stored && resolvedUrls.includes(stored)) return stored;
  return resolvedUrls[0];
}

export function pickInitialDnsServer(options: DnsServerOption[]): string {
  const stored = getStoredDnsServer();
  if (stored && options.some((o) => o.address === stored)) return stored;
  return options[0]?.address ?? "1.1.1.1";
}

export function isValidIpAddress(value: string): boolean {
  if (!value || value === "auto") return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((part) => {
      const n = Number(part);
      return n >= 0 && n <= 255;
    });
  }
  return /^[\da-f:]+$/i.test(value) && value.includes(":");
}
