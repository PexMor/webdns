/** DNS record type codes exposed in the lookup UI (matches hickory-resolver support). */
export type RecordType = string;

export interface RecordTypeGroup {
  label: string;
  types: RecordType[];
}

export interface RecordTypeHelpEntry {
  title: string;
  description: string;
  example: string | null;
  /** For record types with a lookup-convention transform (see
   *  `queryTransforms.ts`): a worked example of the human-friendly input and
   *  the query name it resolves to. */
  transformExample?: { input: string; queryName: string };
}

/** A single per-record-type result from the backend. */
export interface DnsRecordResult {
  record_type: RecordType;
  records?: string[];
  error?: string;
}

/** Backend WebSocket response for a completed lookup. */
export interface DnsQueryResponse {
  domain: string;
  results: DnsRecordResult[];
  error?: string;
}

/** Backend WebSocket request payload for a lookup. */
export interface DnsQueryRequest {
  domain: string;
  record_types: RecordType[];
  dns_server?: string;
}

/** Connection header used to authenticate the WebSocket handshake via query params. */
export interface WsHeader {
  name: string;
  value: string;
  enabled: boolean;
  builtin?: boolean;
  fromConfig?: boolean;
  suggestion?: boolean;
}

export interface DnsServerConfigEntry {
  label: string;
  address: string;
}

export interface CustomDnsServer {
  address: string;
  label: string;
  addedAt: string;
}

export interface DnsServerOption {
  label: string;
  address: string;
  resolvedAddress: string;
  custom: boolean;
}

/** Identity-aware proxy (Cloudflare Access-style) session-expiry detection. */
export interface IdentityProxyConfig {
  enabled: boolean;
  probePath: string;
}

export interface RuntimeConfig {
  wsUrls: string[];
  dnsServers: DnsServerConfigEntry[];
  wsConnectionHeaders: WsHeader[];
  wsHeaderQueryMap: Record<string, string>;
  identityProxy: IdentityProxyConfig;
}

/** Extra input state for record types whose query name is constructed from a
 *  lookup convention (see `queryTransforms.ts`) rather than the domain field
 *  alone. All optional/defaulted so older persisted records without them
 *  reproduce today's "no convention engaged" behavior. */
export interface ConventionFormState {
  enumMode?: boolean;
  srvFields?: { service: string; protocol: string };
  tlsaFields?: { port: string; transport: string };
}

export interface LookupFormState extends ConventionFormState {
  domain: string;
  recordTypes: RecordType[];
}

export interface LookupHistoryEntry extends ConventionFormState {
  id?: number;
  domain: string;
  recordTypes: RecordType[];
  dnsServerAddress: string;
  dnsServerResolved: string;
  timestamp: string;
  /** Per-record-type results as returned by the backend at the time this
   *  entry was recorded, so History can show what was found without
   *  re-running the query. Absent for entries recorded before this field
   *  existed, or when the query didn't get a response at all. */
  results?: DnsRecordResult[];
  /** Set instead of `results` when the query failed outright (no response),
   *  e.g. a connection error. */
  responseError?: string;
}

export interface QuickLookup extends ConventionFormState {
  id: string;
  name: string;
  domain: string;
  recordTypes: RecordType[];
  includeDnsServer: boolean;
  dnsServerAddress: string | null;
  sortOrder: number;
}

export interface QuickLookupInput extends ConventionFormState {
  name: string;
  domain: string;
  recordTypes: RecordType[];
  includeDnsServer?: boolean;
  dnsServerAddress?: string | null;
}

export interface BuildInfo {
  version: string;
  gitHash: string;
  buildTime: string;
}

export interface PreferenceRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt?: string;
}
