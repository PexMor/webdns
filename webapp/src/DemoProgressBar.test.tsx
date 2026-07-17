import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoProgressBar } from "./DemoProgressBar";
import type { HistoryExportEntry } from "./lookupHistoryStore";

const entries: HistoryExportEntry[] = [
  {
    domain: "one.test",
    recordTypes: ["A"],
    dnsServerAddress: "1.1.1.1",
    dnsServerResolved: "1.1.1.1",
    timestamp: "2026-07-17T10:00:00.000Z",
  },
  {
    domain: "two.test",
    recordTypes: ["MX"],
    dnsServerAddress: "1.1.1.1",
    dnsServerResolved: "1.1.1.1",
    timestamp: "2026-07-17T10:00:05.000Z",
  },
];

describe("DemoProgressBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows not-started state before the first step", () => {
    render(
      <DemoProgressBar
        entries={entries}
        currentIndex={null}
        onSelectStep={() => {}}
        onNextStep={() => {}}
      />
    );
    expect(screen.getByText(/Not started · 2 steps/)).toBeTruthy();
    expect(screen.getByText(/Click a step or Next to explore/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  });

  it("highlights the current step and query during autoplay", () => {
    const { container } = render(
      <DemoProgressBar
        entries={entries}
        currentIndex={1}
        autoplayRunning
        autoplayCountdownSec={4}
        autoplayIntervalMs={5000}
      />
    );
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
    expect(screen.getByText(/two.test/)).toBeTruthy();
    expect(screen.getByText(/playing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next step in 4 seconds/ })).toBeTruthy();
    expect(screen.getByText(/Next 4s/)).toBeTruthy();
    expect(container.querySelectorAll(".demo-progress__segment--current")).toHaveLength(1);
    expect(container.querySelectorAll(".demo-progress__segment--done")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("calls onSelectStep when a segment is clicked while stopped", () => {
    const onSelectStep = vi.fn();
    render(
      <DemoProgressBar
        entries={entries}
        currentIndex={0}
        onSelectStep={onSelectStep}
        onNextStep={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Step 2: two.test/ }));
    expect(onSelectStep).toHaveBeenCalledWith(1);
  });

  it("calls onNextStep when Next is clicked while stopped", () => {
    const onNextStep = vi.fn();
    render(
      <DemoProgressBar
        entries={entries}
        currentIndex={0}
        onSelectStep={() => {}}
        onNextStep={onNextStep}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNextStep).toHaveBeenCalledTimes(1);
  });
});
