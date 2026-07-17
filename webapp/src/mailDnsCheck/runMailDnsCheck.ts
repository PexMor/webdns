import { extractSpfLines } from "./normalize";
import {
  parseMxRecords,
  parseNsHostnames,
  queryPtr,
  queryRecords,
  recordsForType,
  responseError,
} from "./queryHelpers";
import type {
  MailDnsCheckInput,
  MailDnsCheckReport,
  MailDnsQueryFn,
  NameserverInfo,
  RunMailDnsCheckOptions,
} from "./types";
import {
  assembleReport,
  checkMailPolicy,
  checkMxFcrds,
  checkNsConsistency,
  type MxHostSnapshot,
  type NsRecordSnapshot,
} from "./validation";

function reportProgress(
  onProgress: RunMailDnsCheckOptions["onProgress"],
  phase: string,
  message: string,
  completed: number,
  total: number
) {
  onProgress?.({ phase, message, completed, total });
}

export async function discoverAuthoritativeNs(
  domain: string,
  query: MailDnsQueryFn,
  defaultResolver: string | undefined,
  onStep?: (completed: number, total: number, message: string) => void
): Promise<NameserverInfo[]> {
  const nsResponse = await query({ domain, recordTypes: ["NS"], dnsServer: defaultResolver });
  const nsErr = responseError(nsResponse);
  if (nsErr) return [];

  const hostnames = parseNsHostnames(recordsForType(nsResponse, "NS"));
  const nameservers: NameserverInfo[] = [];
  let step = 0;
  const total = Math.max(hostnames.length, 1);

  for (const hostname of hostnames) {
    onStep?.(step, total, `Resolving ${hostname}`);
    const aRecords = await queryRecords(query, hostname, ["A", "AAAA"], defaultResolver);
    const ip = aRecords[0]?.trim();
    if (ip) {
      nameservers.push({ hostname, ip });
    }
    step += 1;
  }

  return nameservers;
}

export async function queryRecordsPerNs(
  domain: string,
  nameservers: NameserverInfo[],
  selectors: string[],
  query: MailDnsQueryFn,
  onStep?: (completed: number, total: number, message: string) => void
): Promise<NsRecordSnapshot[]> {
  const snapshots: NsRecordSnapshot[] = [];
  const total = nameservers.length;
  let step = 0;

  for (const ns of nameservers) {
    onStep?.(step, total, `Querying NS ${ns.ip}`);
    const apexTxt = await queryRecords(query, domain, ["TXT"], ns.ip);
    const spfTxt = extractSpfLines(apexTxt);
    const dmarcTxt = await queryRecords(query, `_dmarc.${domain}`, ["TXT"], ns.ip);
    const mxRecords = await queryRecords(query, domain, ["MX"], ns.ip);

    const dkim: NsRecordSnapshot["dkim"] = {};
    for (const selector of selectors) {
      const name = `${selector}._domainkey.${domain}`;
      dkim[selector] = {
        txt: await queryRecords(query, name, ["TXT"], ns.ip),
        cname: await queryRecords(query, name, ["CNAME"], ns.ip),
      };
    }

    snapshots.push({
      nsIp: ns.ip,
      apexTxt,
      spfTxt,
      dmarcTxt,
      mxRecords,
      dkim,
    });
    step += 1;
  }

  return snapshots;
}

export async function queryMxHosts(
  mxRecords: string[],
  query: MailDnsQueryFn,
  defaultResolver: string | undefined,
  onStep?: (completed: number, total: number, message: string) => void
): Promise<MxHostSnapshot[]> {
  const exchanges = [...new Set(parseMxRecords(mxRecords).map((mx) => mx.exchange))];
  const hosts: MxHostSnapshot[] = [];
  const total = exchanges.length;
  let step = 0;

  for (const host of exchanges) {
    onStep?.(step, total, `Checking MX host ${host}`);
    const aRecords = await queryRecords(query, host, ["A"], defaultResolver);
    const aaaaRecords = await queryRecords(query, host, ["AAAA"], defaultResolver);
    const ptrByIp: Record<string, string[]> = {};

    for (const ip of [...aRecords, ...aaaaRecords]) {
      const trimmed = ip.trim();
      if (!trimmed) continue;
      ptrByIp[trimmed] = await queryPtr(query, trimmed, defaultResolver);
    }

    hosts.push({ host, aRecords, aaaaRecords, ptrByIp });
    step += 1;
  }

  return hosts;
}

export async function runMailDnsCheck(
  input: MailDnsCheckInput,
  query: MailDnsQueryFn,
  options: RunMailDnsCheckOptions = {}
): Promise<MailDnsCheckReport> {
  const domain = input.domain.trim().replace(/\.$/, "");
  const selectors = input.dkimSelectors;
  const defaultResolver = options.defaultResolver;
  const onProgress = options.onProgress;

  let completed = 0;
  const estimateTotal = 3 + selectors.length * 2;

  reportProgress(onProgress, "discovery", `Discovering nameservers for ${domain}`, completed, estimateTotal);

  const nameservers = await discoverAuthoritativeNs(domain, query, defaultResolver, (step, total, message) => {
    reportProgress(onProgress, "discovery", message, step, total);
  });
  completed += 1;

  reportProgress(onProgress, "consistency", "Querying authoritative nameservers", completed, estimateTotal);
  const snapshots = await queryRecordsPerNs(domain, nameservers, selectors, query, (step, total, message) => {
    reportProgress(onProgress, "consistency", message, completed + step, total + completed);
  });
  completed += 1;

  const mxRecords = snapshots[0]?.mxRecords ?? [];
  reportProgress(onProgress, "mx", "Checking MX host resolution", completed, estimateTotal);
  const mxHosts = await queryMxHosts(mxRecords, query, defaultResolver, (step, total, message) => {
    reportProgress(onProgress, "mx", message, completed + step, total + completed);
  });
  completed += 1;

  reportProgress(onProgress, "validation", "Validating mail policy", completed, estimateTotal);

  const findings = [
    ...checkNsConsistency(nameservers, snapshots, selectors),
    ...checkMailPolicy(domain, snapshots, selectors),
    ...checkMxFcrds(mxHosts),
  ];

  reportProgress(onProgress, "done", "Report ready", estimateTotal, estimateTotal);
  return assembleReport(domain, nameservers, snapshots, mxHosts, selectors, findings);
}
