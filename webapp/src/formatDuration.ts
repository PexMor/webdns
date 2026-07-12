export interface DurationComponent {
  value: number;
  unit: "d" | "h" | "m" | "s";
}

const UNIT_SECONDS: readonly [DurationComponent["unit"], number][] = [
  ["d", 86400],
  ["h", 3600],
  ["m", 60],
  ["s", 1],
];

/** Breaks a non-negative seconds count into an exact d/h/m/s component list,
 *  omitting zero-valued components. No rounding: the components always sum
 *  back to the input exactly. Returns `[{ value: 0, unit: "s" }]` for `0`. */
export function formatDuration(seconds: number): DurationComponent[] {
  let remainder = Math.trunc(seconds);
  const components: DurationComponent[] = [];

  for (const [unit, unitSeconds] of UNIT_SECONDS) {
    const value = Math.floor(remainder / unitSeconds);
    if (value > 0) {
      components.push({ value, unit });
      remainder -= value * unitSeconds;
    }
  }

  return components.length > 0 ? components : [{ value: 0, unit: "s" }];
}
