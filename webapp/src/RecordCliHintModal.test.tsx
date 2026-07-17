import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordCliHintModal } from "./RecordCliHintModal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RecordCliHintModal", () => {
  it("copies the dig command when its copy button is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(
      <RecordCliHintModal
        open
        onClose={() => {}}
        recordType="MX"
        domain="nasoutez.eu"
        dnsServerResolved="1.1.1.1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy dig (Linux, macOS, BIND) command" }));
    expect(writeText).toHaveBeenCalledWith("dig @1.1.1.1 MX +short nasoutez.eu");
    expect(screen.getByRole("button", { name: "Copy dig (Linux, macOS, BIND) command" }).textContent).toBe(
      "Copied"
    );
  });
});
