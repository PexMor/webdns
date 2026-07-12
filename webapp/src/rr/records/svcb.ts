import { FieldList } from "../FieldList";
import { registerRrTypes } from "../registry";
import type { ParsedFieldValues, RrFieldMeta, RrParser } from "../types";
import { isInteger, tokenize } from "../tokenize";

type SvcbFields = ParsedFieldValues & {
  priority: string;
  target: string;
  params: string[];
};

function formatParam(token: string): string {
  const eq = token.indexOf("=");
  if (eq === -1) return token;
  const key = token.slice(0, eq);
  let value = token.slice(eq + 1);
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  return `${key}=${value}`;
}

const parseSvcb: RrParser<SvcbFields> = (raw) => {
  const tokens = tokenize(raw);
  if (tokens.length < 2) return null;
  const [priority, target, ...paramTokens] = tokens;
  if (!isInteger(priority)) return null;
  return { priority, target, params: paramTokens.map(formatParam) };
};

function svcbFields(kind: "HTTPS" | "SVCB"): RrFieldMeta[] {
  const service = kind === "HTTPS" ? "HTTPS" : "the advertised service";
  return [
    {
      key: "priority",
      label: "Priority",
      explain: {
        minimal: "Priority",
        standard: "Lower numbers are preferred; priority 0 means 'alias mode'.",
        detailed:
          "SvcPriority (RFC 9460). A value of 0 makes this an AliasForm record pointing entirely at the target; any other value is a ServiceForm record ranked against other records for the same name (lower is preferred).",
      },
    },
    {
      key: "target",
      label: "Target",
      explain: {
        minimal: "Target hostname",
        standard: `The hostname that provides ${service}.`,
        detailed: `TargetName: the hostname to connect to for ${service}. A single '.' means "use this owner name itself".`,
      },
    },
    {
      key: "params",
      label: "Service parameters",
      explain: {
        minimal: "Connection hints",
        standard:
          "Key-value hints such as alpn (supported protocols), port, or address hints, used to speed up or improve the connection.",
        detailed:
          "SvcParams: key=value pairs such as alpn (ALPN protocol IDs), port, ipv4hint/ipv6hint (address hints to skip a lookup), and ech (Encrypted Client Hello configuration).",
      },
    },
  ];
}

registerRrTypes({
  HTTPS: { parse: parseSvcb, fields: svcbFields("HTTPS"), View: FieldList },
  SVCB: { parse: parseSvcb, fields: svcbFields("SVCB"), View: FieldList },
});
