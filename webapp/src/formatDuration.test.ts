import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatDuration";

describe("formatDuration", () => {
  it("renders zero as 0s", () => {
    expect(formatDuration(0)).toEqual([{ value: 0, unit: "s" }]);
  });

  it("renders sub-minute values as seconds", () => {
    expect(formatDuration(30)).toEqual([{ value: 30, unit: "s" }]);
  });

  it("renders exact days without smaller units", () => {
    expect(formatDuration(86400)).toEqual([{ value: 1, unit: "d" }]);
  });

  it("renders a mixed-magnitude value as a full breakdown", () => {
    expect(formatDuration(90061)).toEqual([
      { value: 1, unit: "d" },
      { value: 1, unit: "h" },
      { value: 1, unit: "m" },
      { value: 1, unit: "s" },
    ]);
  });

  it("renders a week as 7d", () => {
    expect(formatDuration(604800)).toEqual([{ value: 7, unit: "d" }]);
  });

  it("handles large values near 2^32 without overflow or rounding", () => {
    const seconds = 4294967295;
    const components = formatDuration(seconds);
    const total = components.reduce((sum, { value, unit }) => {
      const unitSeconds = { d: 86400, h: 3600, m: 60, s: 1 }[unit];
      return sum + value * unitSeconds;
    }, 0);
    expect(total).toBe(seconds);
    expect(components[0]).toEqual({ value: 49710, unit: "d" });
  });
});
