import { RECORD_TYPES } from "./recordTypes";
import type { ConventionFormState } from "./types";

/** The subset of a lookup that's meaningful to reproduce from a shared URL:
 *  everything needed to re-run the same query, but never the DNS server's
 *  credentials/headers or any previously-fetched result payload (results
 *  are re-fetched live so the recipient sees current data). */
export interface UrlQueryState extends ConventionFormState {
  domain: string;
  recordTypes: string[];
  dnsServerAddress?: string;
}

/** Encodes a lookup as `key=value` pairs for the URL fragment (without the
 *  leading `#`), using `URLSearchParams` for correct percent-encoding. */
export function encodeQueryFragment(state: UrlQueryState): string {
  const params = new URLSearchParams();
  params.set("domain", state.domain);
  params.set("types", state.recordTypes.join(","));
  if (state.dnsServerAddress) params.set("server", state.dnsServerAddress);
  if (state.enumMode) params.set("enum", "1");
  if (state.srvFields?.service) params.set("service", state.srvFields.service);
  if (state.srvFields?.protocol) params.set("protocol", state.srvFields.protocol);
  if (state.tlsaFields?.port) params.set("port", state.tlsaFields.port);
  if (state.tlsaFields?.transport) params.set("transport", state.tlsaFields.transport);
  return params.toString();
}

/** Decodes a URL fragment (with or without the leading `#`) back into a
 *  lookup, or `null` if it has no usable domain/record types. Unknown record
 *  type codes are dropped rather than rejecting the whole fragment, so an
 *  otherwise-valid shared link degrades gracefully. */
export function decodeQueryFragment(hash: string): UrlQueryState | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const domain = params.get("domain")?.trim();
  const typesRaw = params.get("types");
  if (!domain || !typesRaw) return null;

  const validTypes = new Set(RECORD_TYPES);
  const recordTypes = typesRaw
    .split(",")
    .map((type) => type.trim().toUpperCase())
    .filter((type) => validTypes.has(type));
  if (recordTypes.length === 0) return null;

  const dnsServerAddress = params.get("server")?.trim() || undefined;
  const enumMode = params.get("enum") === "1";
  const service = params.get("service")?.trim() ?? "";
  const protocol = params.get("protocol")?.trim() ?? "";
  const port = params.get("port")?.trim() ?? "";
  const transport = params.get("transport")?.trim() ?? "";

  return {
    domain,
    recordTypes,
    dnsServerAddress,
    enumMode,
    srvFields: service || protocol ? { service, protocol } : undefined,
    tlsaFields: port || transport ? { port, transport } : undefined,
  };
}
