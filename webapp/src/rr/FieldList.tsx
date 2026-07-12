import { LabeledField } from "./LabeledField";
import type { ParsedFieldValues, RrViewProps } from "./types";

/** Generic parsed-record view: renders each field in `fields` as a labeled
 *  row, in order, using whatever value is present in `value`. Used as the
 *  `View` for most record types, which only need to supply field metadata
 *  and a parser rather than a bespoke component. */
export function FieldList<T extends ParsedFieldValues>({
  fields,
  detailLevel,
  value,
}: RrViewProps<T>) {
  return (
    <div class="rr-field-list">
      {fields.map((field) => (
        <LabeledField
          key={field.key}
          label={field.label}
          value={value[field.key] ?? ""}
          explain={field.explain}
          detailLevel={detailLevel}
          kind={field.kind}
        />
      ))}
    </div>
  );
}
