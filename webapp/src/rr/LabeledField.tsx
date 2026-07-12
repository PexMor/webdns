import { DurationValue } from "./DurationValue";
import type { DetailLevel, FieldExplain, RrFieldMeta } from "./types";
import { resolveExplain } from "./types";

export interface LabeledFieldProps {
  label: string;
  value: string | string[];
  explain: FieldExplain;
  detailLevel: DetailLevel;
  kind?: RrFieldMeta["kind"];
}

export function LabeledField({ label, value, explain, detailLevel, kind }: LabeledFieldProps) {
  const explanation = resolveExplain(explain, detailLevel);
  const values = Array.isArray(value) ? value : [value];

  return (
    <div class="rr-field">
      <div class="rr-field__row">
        <span class="rr-field__label">{label}</span>
        <span class="rr-field__value">
          {values.map((v, i) => (
            <span class="rr-field__value-item" key={i}>
              {kind === "duration-seconds" ? <DurationValue seconds={v} /> : v}
            </span>
          ))}
        </span>
      </div>
      {explanation && <p class="rr-field__explain">{explanation}</p>}
    </div>
  );
}
