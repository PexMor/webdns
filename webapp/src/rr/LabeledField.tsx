import { DurationValue } from "./DurationValue";
import type { DetailLevel, FieldExplain, FollowUpQuery, RrFieldMeta } from "./types";
import { resolveExplain } from "./types";

export interface LabeledFieldProps {
  label: string;
  value: string | string[];
  explain: FieldExplain;
  detailLevel: DetailLevel;
  kind?: RrFieldMeta["kind"];
  decode?: (raw: string) => string | null;
  onFollowUp?: (query: FollowUpQuery) => void;
}

/** Placeholder values meaning "not available" in DNS presentation format
 *  (SRV/NAPTR/SVCB target/replacement fields) — never actionable. */
export function isPlaceholderHostname(value: string): boolean {
  return value === "." || value.trim() === "";
}

export function followUpForKind(
  kind: "ip-address" | "hostname" | "txt",
  value: string
): FollowUpQuery | null {
  if (kind === "ip-address") {
    return { domain: value, recordTypes: ["PTR"] };
  }
  if (kind === "txt" && !isPlaceholderHostname(value)) {
    return { domain: value, recordTypes: ["TXT"] };
  }
  if (kind === "hostname" && !isPlaceholderHostname(value)) {
    return { domain: value, recordTypes: ["A", "AAAA"] };
  }
  return null;
}

/** Renders a single `ip-address`/`hostname`-kind value as a clickable
 *  follow-up trigger when `onFollowUp` is supplied and the value is
 *  actionable, or as plain text otherwise. Reusable both for a whole field
 *  value (via `LabeledField`) and for an inline token embedded within a
 *  larger value (e.g. an SPF mechanism's domain, or an SVCB param's
 *  address hint). */
export function FollowUpValue({
  value,
  kind,
  onFollowUp,
}: {
  value: string;
  kind: "ip-address" | "hostname" | "txt";
  onFollowUp?: (query: FollowUpQuery) => void;
}) {
  const followUp = onFollowUp ? followUpForKind(kind, value) : null;
  if (followUp) {
    return (
      <button type="button" class="rr-field__followup" onClick={() => onFollowUp!(followUp)}>
        {value}
      </button>
    );
  }
  return <>{value}</>;
}

function FieldValue({
  value,
  kind,
  decode,
  onFollowUp,
}: {
  value: string;
  kind?: RrFieldMeta["kind"];
  decode?: (raw: string) => string | null;
  onFollowUp?: (query: FollowUpQuery) => void;
}) {
  if (kind === "duration-seconds") {
    return <DurationValue seconds={value} />;
  }

  if (kind === "email-encoded") {
    const decoded = decode?.(value) ?? null;
    return (
      <>
        {value}
        {decoded && (
          <a class="rr-field__mailto" href={`mailto:${decoded}`}>
            {" "}
            {decoded}
          </a>
        )}
      </>
    );
  }

  if (kind === "ip-address" || kind === "hostname") {
    return <FollowUpValue value={value} kind={kind} onFollowUp={onFollowUp} />;
  }

  return <>{value}</>;
}

export function LabeledField({
  label,
  value,
  explain,
  detailLevel,
  kind,
  decode,
  onFollowUp,
}: LabeledFieldProps) {
  const explanation = resolveExplain(explain, detailLevel);
  const values = Array.isArray(value) ? value : [value];

  return (
    <div class="rr-field">
      <div class="rr-field__row">
        <span class="rr-field__label">{label}</span>
        <span class="rr-field__value">
          {values.map((v, i) => (
            <span class="rr-field__value-item" key={i}>
              <FieldValue value={v} kind={kind} decode={decode} onFollowUp={onFollowUp} />
            </span>
          ))}
        </span>
      </div>
      {explanation && <p class="rr-field__explain">{explanation}</p>}
    </div>
  );
}
