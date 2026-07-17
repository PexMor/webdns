import type { DnsQueryResponse } from "../types";

export type CheckSeverity = "issue" | "warning" | "pass";

export interface CheckFinding {
  severity: CheckSeverity;
  message: string;
}

export type ReportStatus = "OK" | "WARNINGS" | "ERRORS";

export interface NameserverInfo {
  hostname: string;
  ip: string;
}

export interface ConsistencyRow {
  label: string;
  consistent: boolean;
  value: string;
}

export interface MxHostRow {
  host: string;
  aRecords: string;
  ptr: string;
  fcrds: "ok" | "fail" | "missing" | "na";
}

export interface PerNsDkimRecords {
  txt: string[];
  cname: string[];
}

export interface PerNsRecords {
  nsIp: string;
  spf: string[];
  otherApexTxt: string[];
  dmarc: string[];
  mx: string[];
  dkim: Record<string, PerNsDkimRecords>;
}

export interface MailDnsCheckReport {
  domain: string;
  generatedAt: string;
  status: ReportStatus;
  issueCount: number;
  warningCount: number;
  passCount: number;
  issues: string[];
  warnings: string[];
  passes: string[];
  nameservers: NameserverInfo[];
  consistencyRows: ConsistencyRow[];
  mxHostRows: MxHostRow[];
  perNsRecords: PerNsRecords[];
}

export interface MailDnsCheckInput {
  domain: string;
  dkimSelectors: string[];
}

export interface MailDnsQueryRequest {
  domain: string;
  recordTypes: string[];
  dnsServer?: string;
}

export type MailDnsQueryFn = (req: MailDnsQueryRequest) => Promise<DnsQueryResponse>;

export interface MailDnsCheckProgress {
  phase: string;
  message: string;
  completed: number;
  total: number;
}

export interface RunMailDnsCheckOptions {
  onProgress?: (progress: MailDnsCheckProgress) => void;
  defaultResolver?: string;
}
