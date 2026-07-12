import { formatDuration } from "../formatDuration";

export interface DurationValueProps {
  seconds: string | number;
}

/** Renders a seconds count as a compact, colored d/h/m/s breakdown, with the
 *  exact seconds count available via a tooltip. */
export function DurationValue({ seconds }: DurationValueProps) {
  const total = typeof seconds === "number" ? seconds : Number(seconds);
  const components = formatDuration(total);

  return (
    <span class="duration" title={`${total} seconds`}>
      {components.map(({ value, unit }) => (
        <span key={unit}>
          <span class="duration__value">{value}</span>
          <span class="duration__unit">{unit}</span>
        </span>
      ))}
    </span>
  );
}
