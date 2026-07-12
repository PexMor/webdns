export interface GenericViewProps {
  raw: string;
}

/** Fallback for record types with no registered parser/view, or whose raw
 *  string didn't match the registered parser's expected shape. */
export function GenericView({ raw }: GenericViewProps) {
  return (
    <div class="rr-field-list rr-field-list--generic">
      <div class="rr-field">
        <div class="rr-field__row">
          <span class="rr-field__label">Raw value</span>
          <span class="rr-field__value">{raw}</span>
        </div>
      </div>
    </div>
  );
}
