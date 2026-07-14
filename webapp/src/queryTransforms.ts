/** DNS lookup convention transforms: construct a QNAME from human-friendly
 *  input (IP address, phone number, service/protocol, port/transport, email
 *  address) for the record types whose application conventions require it.
 *  Every transform falls back to treating the input as a literal owner name
 *  when its convention isn't engaged, so plain queries against these record
 *  types keep working unchanged. */

export type ConventionId = "reverse-dns" | "enum" | "srv" | "tlsa" | "openpgpkey" | "smimea";

export interface SrvFields {
  service: string;
  protocol: string;
}

export interface TlsaFields {
  port: string;
  transport: string;
}

export interface TransformSuccess {
  queryName: string;
}

export interface TransformError {
  error: string;
}

export type TransformResult = TransformSuccess | TransformError;

export interface EngagementInput {
  recordTypes: string[];
  domain: string;
  enumMode: boolean;
  srvFields: SrvFields;
  tlsaFields: TlsaFields;
}

export interface TransformInput {
  recordTypes: string[];
  domain: string;
  enumMode?: boolean;
  srvFields?: SrvFields;
  tlsaFields?: TlsaFields;
}

export const DEFAULT_SRV_FIELDS: SrvFields = { service: "", protocol: "" };
export const DEFAULT_TLSA_FIELDS: TlsaFields = { port: "", transport: "" };

// --- Reverse DNS (PTR) ---

function isIpv4Address(input: string): boolean {
  const parts = input.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** Expands an IPv6 literal (including `::` shorthand and an embedded IPv4
 *  tail) into 8 zero-padded lowercase hex groups, or `null` if invalid. */
function expandIpv6Groups(input: string): string[] | null {
  if (!input || input.includes("%")) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(input)) return null;

  const doubleColonCount = (input.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;
  const hasDoubleColon = doubleColonCount === 1;

  let head: string[];
  let tail: string[];
  if (hasDoubleColon) {
    const idx = input.indexOf("::");
    const left = input.slice(0, idx);
    const right = input.slice(idx + 2);
    head = left ? left.split(":") : [];
    tail = right ? right.split(":") : [];
  } else {
    head = input.split(":");
    tail = [];
  }

  const expandedHead = expandEmbeddedIpv4(head);
  const expandedTail = expandEmbeddedIpv4(tail);
  if (expandedHead === null || expandedTail === null) return null;

  const totalGroups = expandedHead.length + expandedTail.length;
  let groups: string[];
  if (hasDoubleColon) {
    if (totalGroups > 8) return null;
    groups = [...expandedHead, ...new Array(8 - totalGroups).fill("0"), ...expandedTail];
  } else {
    if (totalGroups !== 8) return null;
    groups = expandedHead;
  }

  if (!groups.every((group) => /^[0-9a-fA-F]{1,4}$/.test(group))) return null;
  return groups.map((group) => group.padStart(4, "0").toLowerCase());
}

function expandEmbeddedIpv4(groups: string[]): string[] | null {
  if (groups.length === 0) return groups;
  const last = groups[groups.length - 1];
  if (!last.includes(".")) return groups;
  if (!isIpv4Address(last)) return null;

  const octets = last.split(".").map(Number);
  const high = ((octets[0] << 8) | octets[1]).toString(16);
  const low = ((octets[2] << 8) | octets[3]).toString(16);
  return [...groups.slice(0, -1), high, low];
}

function isIpv6Address(input: string): boolean {
  return expandIpv6Groups(input) !== null;
}

export function isIpAddress(input: string): boolean {
  const trimmed = input.trim();
  return isIpv4Address(trimmed) || isIpv6Address(trimmed);
}

export function ipv4ToInAddrArpa(input: string): string | null {
  const trimmed = input.trim();
  if (!isIpv4Address(trimmed)) return null;
  return `${trimmed.split(".").reverse().join(".")}.in-addr.arpa`;
}

export function ipv6ToIp6Arpa(input: string): string | null {
  const groups = expandIpv6Groups(input.trim());
  if (!groups) return null;
  return `${groups.join("").split("").reverse().join(".")}.ip6.arpa`;
}

export function isArpaReverseName(input: string): boolean {
  const trimmed = input.trim().toLowerCase().replace(/\.$/, "");
  return trimmed.endsWith(".in-addr.arpa") || trimmed.endsWith(".ip6.arpa");
}

// --- ENUM (NAPTR) ---

export function phoneToE164Arpa(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `${digits.split("").reverse().join(".")}.e164.arpa`;
}

// --- SRV / TLSA ---

const DNS_LABEL_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function normalizeLabelToken(token: string): string | null {
  const stripped = token.startsWith("_") ? token.slice(1) : token;
  return DNS_LABEL_RE.test(stripped) ? stripped : null;
}

export function srvOwnerName(service: string, protocol: string, domain: string): string | null {
  const svc = normalizeLabelToken(service.trim());
  const proto = normalizeLabelToken(protocol.trim());
  if (!svc || !proto) return null;
  return `_${svc}._${proto}.${domain.trim()}`;
}

export function tlsaOwnerName(port: string, transport: string, domain: string): string | null {
  const portNum = Number(port.trim());
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return null;
  const transportToken = normalizeLabelToken(transport.trim());
  if (!transportToken) return null;
  return `_${portNum}._${transportToken}.${domain.trim()}`;
}

export function parseUrlForTlsa(input: string): { port: number; host: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol === "https:") return { port: url.port ? Number(url.port) : 443, host: url.hostname };
  if (url.protocol === "http:") return { port: url.port ? Number(url.port) : 80, host: url.hostname };
  return null;
}

// --- OPENPGPKEY / SMIMEA ---

export function isEmailAddress(input: string): boolean {
  const trimmed = input.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return false;
  if (trimmed.indexOf("@", at + 1) !== -1) return false;
  return trimmed.slice(at + 1).length > 0;
}

/** RFC 7929 §3 / RFC 8162 §3: unquote and NFC-normalize the local-part.
 *  Case is preserved — neither RFC calls for case-folding. */
function canonicalizeLocalPart(localPart: string): string {
  const unquoted =
    localPart.length >= 2 && localPart.startsWith('"') && localPart.endsWith('"')
      ? localPart.slice(1, -1)
      : localPart;
  return unquoted.normalize("NFC");
}

export const EMAIL_HASH_UNAVAILABLE_ERROR = "Email-based lookups require a secure (HTTPS) context.";

async function sha256HexTruncated28(input: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest).slice(0, 28), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function emailHashOwnerName(email: string, label: "_openpgpkey" | "_smimecert"): Promise<TransformResult> {
  const at = email.indexOf("@");
  const localPart = canonicalizeLocalPart(email.slice(0, at));
  const domainPart = email.slice(at + 1);
  const hash = await sha256HexTruncated28(localPart);
  if (hash === null) return { error: EMAIL_HASH_UNAVAILABLE_ERROR };
  return { queryName: `${hash}.${label}.${domainPart}` };
}

/** RFC 7929 §3: SHA-256 of the local-part, truncated to 28 octets, hex-encoded. */
export function openpgpkeyOwnerName(email: string): Promise<TransformResult> {
  return emailHashOwnerName(email, "_openpgpkey");
}

/** RFC 8162 §3: same hash construction as OPENPGPKEY, `_smimecert` label. */
export function smimeaOwnerName(email: string): Promise<TransformResult> {
  return emailHashOwnerName(email, "_smimecert");
}

// --- Engagement + dispatch ---

/** Determines which convention (if any) the current selection/input engages.
 *  Engagement means the resolved query name will diverge from the literal
 *  domain field, which is what makes combining with other record types
 *  incoherent — see design.md Decision 3. */
export function engagedConvention({
  recordTypes,
  domain,
  enumMode,
  srvFields,
  tlsaFields,
}: EngagementInput): ConventionId | null {
  const types = new Set(recordTypes);
  const trimmedDomain = domain.trim();

  if (types.has("PTR") && isIpAddress(trimmedDomain)) return "reverse-dns";
  if (types.has("NAPTR") && enumMode) return "enum";
  if (types.has("SRV") && (srvFields.service.trim() !== "" || srvFields.protocol.trim() !== "")) return "srv";
  if (
    types.has("TLSA") &&
    (tlsaFields.port.trim() !== "" || tlsaFields.transport.trim() !== "" || parseUrlForTlsa(trimmedDomain) !== null)
  ) {
    return "tlsa";
  }
  if (types.has("OPENPGPKEY") && isEmailAddress(trimmedDomain)) return "openpgpkey";
  if (types.has("SMIMEA") && isEmailAddress(trimmedDomain)) return "smimea";
  return null;
}

/** Resolves the query name to send for the current selection/input. When no
 *  convention is engaged, returns the literal domain unchanged (the default,
 *  freely-combinable behavior for every record type). */
export async function transformQueryInput({
  recordTypes,
  domain,
  enumMode = false,
  srvFields = DEFAULT_SRV_FIELDS,
  tlsaFields = DEFAULT_TLSA_FIELDS,
}: TransformInput): Promise<TransformResult> {
  const trimmedDomain = domain.trim();
  const convention = engagedConvention({ recordTypes, domain, enumMode, srvFields, tlsaFields });

  switch (convention) {
    case null:
      return { queryName: trimmedDomain };

    case "reverse-dns": {
      const queryName = isIpv4Address(trimmedDomain)
        ? ipv4ToInAddrArpa(trimmedDomain)
        : ipv6ToIp6Arpa(trimmedDomain);
      return queryName ? { queryName } : { queryName: trimmedDomain };
    }

    case "enum": {
      const arpa = phoneToE164Arpa(trimmedDomain);
      return arpa ? { queryName: arpa } : { error: "Enter a phone number with at least one digit." };
    }

    case "srv": {
      const service = srvFields.service.trim();
      const protocol = srvFields.protocol.trim();
      if (!service || !protocol) {
        return { error: "Enter both Service and Protocol, or leave both blank to query the domain directly." };
      }
      const owner = srvOwnerName(service, protocol, trimmedDomain);
      return owner
        ? { queryName: owner }
        : { error: "Service and Protocol must be simple DNS labels (letters, digits, hyphens)." };
    }

    case "tlsa": {
      const port = tlsaFields.port.trim();
      const transport = tlsaFields.transport.trim();
      if (port || transport) {
        if (!port || !transport) {
          return { error: "Enter both Port and Transport, or leave both blank to query the domain directly." };
        }
        const owner = tlsaOwnerName(port, transport, trimmedDomain);
        return owner ? { queryName: owner } : { error: "Port must be 1-65535 and Transport must be a simple DNS label." };
      }
      const url = parseUrlForTlsa(trimmedDomain);
      if (!url) return { queryName: trimmedDomain };
      const owner = tlsaOwnerName(String(url.port), "tcp", url.host);
      return owner ? { queryName: owner } : { queryName: trimmedDomain };
    }

    case "openpgpkey":
      return openpgpkeyOwnerName(trimmedDomain);

    case "smimea":
      return smimeaOwnerName(trimmedDomain);
  }
}
