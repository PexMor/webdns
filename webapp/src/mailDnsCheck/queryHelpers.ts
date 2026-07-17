import type { DnsQueryResponse } from "../types";
import { transformQueryInput } from "../queryTransforms";
import { stripTrailingDot } from "./normalize";
import type { MailDnsQueryFn } from "./types";

export function recordsForType(response: DnsQueryResponse, recordType: string): string[] {
  const entry = response.results.find((result) => result.record_type === recordType);
  if (!entry || entry.error) return [];
  return entry.records ?? [];
}

export function responseError(response: DnsQueryResponse): string | null {
  if (response.error) return response.error;
  const failed = response.results.find((result) => result.error);
  return failed?.error ?? null;
}

export async function queryRecords(
  query: MailDnsQueryFn,
  domain: string,
  recordTypes: string[],
  dnsServer?: string
): Promise<string[]> {
  const response = await query({ domain, recordTypes, dnsServer });
  const err = responseError(response);
  if (err) return [];
  return recordTypes.flatMap((type) => recordsForType(response, type));
}

export async function queryPtr(
  query: MailDnsQueryFn,
  ip: string,
  dnsServer?: string
): Promise<string[]> {
  const transformed = await transformQueryInput({ recordTypes: ["PTR"], domain: ip });
  if ("error" in transformed) return [];
  const response = await query({
    domain: transformed.queryName,
    recordTypes: ["PTR"],
    dnsServer,
  });
  return recordsForType(response, "PTR");
}

export function parseMxRecords(records: string[]): Array<{ preference: string; exchange: string }> {
  const parsed: Array<{ preference: string; exchange: string }> = [];
  for (const line of records) {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 2) continue;
    parsed.push({
      preference: tokens[0],
      exchange: stripTrailingDot(tokens[1]),
    });
  }
  return parsed;
}

export function parseNsHostnames(records: string[]): string[] {
  return records.map((line) => stripTrailingDot(line.trim())).filter(Boolean);
}

export function parseDkimSelectorsInput(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
