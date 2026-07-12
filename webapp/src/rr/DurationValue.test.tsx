import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DurationValue } from "./DurationValue";

afterEach(cleanup);

describe("DurationValue", () => {
  it("renders a single-unit value and exposes the exact seconds as a tooltip", () => {
    render(<DurationValue seconds="86400" />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("d")).toBeTruthy();
    expect(screen.getByTitle("86400 seconds")).toBeTruthy();
  });

  it("renders a mixed-magnitude value as a full breakdown", () => {
    render(<DurationValue seconds={90061} />);

    expect(screen.getByTitle("90061 seconds").textContent).toBe("1d1h1m1s");
  });

  it("renders zero as 0s", () => {
    render(<DurationValue seconds="0" />);

    expect(screen.getByTitle("0 seconds").textContent).toBe("0s");
  });
});
