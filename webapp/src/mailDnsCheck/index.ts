export type {
  CheckFinding,
  CheckSeverity,
  ConsistencyRow,
  MailDnsCheckInput,
  MailDnsCheckProgress,
  MailDnsCheckReport,
  MailDnsQueryFn,
  MailDnsQueryRequest,
  MxHostRow,
  NameserverInfo,
  PerNsDkimRecords,
  PerNsRecords,
  ReportStatus,
  RunMailDnsCheckOptions,
} from "./types";

export {
  extractSpfLines,
  hostnameMatch,
  normalizeRecordLines,
  recordsMatch,
  stripTrailingDot,
} from "./normalize";

export { runMailDnsCheck } from "./runMailDnsCheck";
export { downloadReportHtml, renderReportHtml } from "./renderHtml";
