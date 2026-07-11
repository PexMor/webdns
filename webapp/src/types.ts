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

export interface RuntimeConfig {
  wsUrls: string[];
  dnsServers: DnsServerConfigEntry[];
  wsConnectionHeaders: WsHeader[];
  wsHeaderQueryMap: Record<string, string>;
}

export interface LookupFormState {
  domain: string;
  recordTypes: RecordType[];
}

export interface LookupHistoryEntry {
  id?: number;
  domain: string;
  recordTypes: RecordType[];
  dnsServerAddress: string;
  dnsServerResolved: string;
  timestamp: string;
}

export interface QuickLookup {
  id: string;
  name: string;
  domain: string;
  recordTypes: RecordType[];
  includeDnsServer: boolean;
  dnsServerAddress: string | null;
  sortOrder: number;
}

export interface QuickLookupInput {
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
