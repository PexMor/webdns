import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordTypeGroups } from "./RecordTypeGroups";

afterEach(cleanup);

function renderGroups(overrides: Partial<Parameters<typeof RecordTypeGroups>[0]> = {}) {
  const toggleType = vi.fn();
  const onOpenHelp = vi.fn();
  render(
    <RecordTypeGroups
      selectedTypes={new Set<string>()}
      toggleType={toggleType}
      isRecordTypeCheckboxDisabled={() => false}
      recordTypeTitle={() => undefined}
      onOpenHelp={onOpenHelp}
      {...overrides}
    />
  );
  return { toggleType, onOpenHelp };
}

describe("RecordTypeGroups", () => {
  it("toggles selection when the record type label text is clicked", () => {
    const { toggleType } = renderGroups();

    fireEvent.click(screen.getByText("AAAA"));

    expect(toggleType).toHaveBeenCalledWith("AAAA");
  });

  it("does not toggle selection when the help button is clicked", () => {
    const { toggleType, onOpenHelp } = renderGroups();

    fireEvent.click(screen.getByLabelText("What is a AAAA record?"));

    expect(onOpenHelp).toHaveBeenCalledWith("AAAA");
    expect(toggleType).not.toHaveBeenCalled();
  });

  it("keeps the help button working when the record type checkbox is disabled", () => {
    const { onOpenHelp } = renderGroups({
      isRecordTypeCheckboxDisabled: (type) => type === "AAAA",
    });

    const checkbox = screen.getByLabelText("AAAA") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("What is a AAAA record?"));

    expect(onOpenHelp).toHaveBeenCalledWith("AAAA");
  });
});
