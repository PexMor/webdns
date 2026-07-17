import { FollowUpValue, LabeledField } from "../LabeledField";
import { registerRrTypes } from "../registry";
import { resolveExplain } from "../types";
import type { FollowUpQuery, ParsedFieldValues, RrFieldMeta, RrParser, RrView } from "../types";
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

/** `ipv4hint`/`ipv6hint` SvcParams (RFC 9460 §7.3) carry one or more
 *  comma-separated address literals. Returns the key and split addresses
 *  for those two params, or `null` for any other param (e.g. `alpn`, `port`,
 *  `ech`), which render as plain text. */
export function parseAddressHint(token: string): { key: string; addresses: string[] } | null {
  const eq = token.indexOf("=");
  if (eq === -1) return null;
  const key = token.slice(0, eq);
  const lowerKey = key.toLowerCase();
  if (lowerKey !== "ipv4hint" && lowerKey !== "ipv6hint") return null;
  const value = token.slice(eq + 1);
  if (!value) return null;
  return { key, addresses: value.split(",") };
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
      kind: "hostname",
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

function ParamValue({
  token,
  onFollowUp,
}: {
  token: string;
  onFollowUp?: (query: FollowUpQuery) => void;
}) {
  const hint = parseAddressHint(token);
  if (!hint) return <>{token}</>;

  return (
    <>
      {hint.key}=
      {hint.addresses.map((address, i) => (
        <span key={i}>
          {i > 0 ? "," : ""}
          <FollowUpValue value={address} kind="ip-address" onFollowUp={onFollowUp} />
        </span>
      ))}
    </>
  );
}

/** SVCB/HTTPS get a bespoke view (rather than the shared `FieldList`) so
 *  `ipv4hint`/`ipv6hint` service-parameter addresses render as individually
 *  clickable follow-ups, while `target` keeps the usual hostname follow-up
 *  and other params (`alpn`, `port`, `ech`, ...) render as plain text. */
function makeSvcbView(fields: RrFieldMeta[]): RrView<SvcbFields> {
  const [priorityField, targetField, paramsField] = fields;
  return function SvcbView({ detailLevel, value, onFollowUp }) {
    const paramsExplanation = resolveExplain(paramsField.explain, detailLevel);
    return (
      <div class="rr-field-list">
        <LabeledField
          label={priorityField.label}
          value={value.priority}
          explain={priorityField.explain}
          detailLevel={detailLevel}
        />
        <LabeledField
          label={targetField.label}
          value={value.target}
          explain={targetField.explain}
          detailLevel={detailLevel}
          kind={targetField.kind}
          onFollowUp={onFollowUp}
        />
        <div class="rr-field">
          <div class="rr-field__row">
            <span class="rr-field__label">{paramsField.label}</span>
            <span class="rr-field__value">
              {value.params.map((token, i) => (
                <span class="rr-field__value-item" key={i}>
                  <ParamValue token={token} onFollowUp={onFollowUp} />
                </span>
              ))}
            </span>
          </div>
          {paramsExplanation && <p class="rr-field__explain">{paramsExplanation}</p>}
        </div>
      </div>
    );
  };
}

const HTTPS_FIELDS = svcbFields("HTTPS");
const SVCB_FIELDS = svcbFields("SVCB");

registerRrTypes({
  HTTPS: { parse: parseSvcb, fields: HTTPS_FIELDS, View: makeSvcbView(HTTPS_FIELDS) },
  SVCB: { parse: parseSvcb, fields: SVCB_FIELDS, View: makeSvcbView(SVCB_FIELDS) },
});
