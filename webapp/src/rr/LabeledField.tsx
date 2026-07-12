import type { DetailLevel, FieldExplain } from "./types";
import { resolveExplain } from "./types";

export interface LabeledFieldProps {
  label: string;
  value: string | string[];
  explain: FieldExplain;
  detailLevel: DetailLevel;
}

export function LabeledField({ label, value, explain, detailLevel }: LabeledFieldProps) {
  const explanation = resolveExplain(explain, detailLevel);
  const values = Array.isArray(value) ? value : [value];

  return (
    <div class="rr-field">
      <div class="rr-field__row">
        <span class="rr-field__label">{label}</span>
        <span class="rr-field__value">
          {values.map((v, i) => (
            <span class="rr-field__value-item" key={i}>
              {v}
            </span>
          ))}
        </span>
      </div>
      {explanation && <p class="rr-field__explain">{explanation}</p>}
    </div>
  );
}
