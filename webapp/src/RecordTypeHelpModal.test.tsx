import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordTypeHelpModal } from "./RecordTypeHelpModal";

afterEach(cleanup);

describe("RecordTypeHelpModal", () => {
  it("renders nothing when no record type is selected", () => {
    const { container } = render(
      <RecordTypeHelpModal
        recordType={null}
        onClose={vi.fn()}
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the parsed view of the example by default for a registered type", () => {
    render(
      <RecordTypeHelpModal
        recordType="MX"
        onClose={vi.fn()}
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    expect(screen.getByText("MX record")).toBeTruthy();
    expect(screen.getByText("Mail exchanger")).toBeTruthy();
    expect(screen.getByText("Show raw")).toBeTruthy();
  });

  it("toggles the help example between parsed and raw", () => {
    render(
      <RecordTypeHelpModal
        recordType="MX"
        onClose={vi.fn()}
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    fireEvent.click(screen.getByText("Show raw"));
    expect(screen.getByText(/IN\s+MX\s+10 mail\.example\.com\./)).toBeTruthy();
    expect(screen.getByText("Show parsed")).toBeTruthy();
  });

  it("falls back to raw example text with no toggle for a type outside the registry", () => {
    render(
      <RecordTypeHelpModal
        recordType="NOTAREALTYPE"
        onClose={vi.fn()}
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    expect(screen.getByText("NOTAREALTYPE record")).toBeTruthy();
    expect(screen.queryByText("Show raw")).toBeNull();
    expect(screen.queryByText("Show parsed")).toBeNull();
  });
});
