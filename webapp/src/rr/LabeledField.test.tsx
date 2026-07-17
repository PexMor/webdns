import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabeledField } from "./LabeledField";

afterEach(cleanup);

const explain = { standard: "some explanation" };

describe("LabeledField", () => {
  it("renders an ip-address field as clickable when onFollowUp is supplied", () => {
    const onFollowUp = vi.fn();
    render(
      <LabeledField
        label="IPv4 address"
        value="93.184.216.34"
        explain={explain}
        detailLevel="standard"
        kind="ip-address"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("93.184.216.34"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "93.184.216.34",
      recordTypes: ["PTR"],
    });
  });

  it("renders a hostname field as clickable when onFollowUp is supplied", () => {
    const onFollowUp = vi.fn();
    render(
      <LabeledField
        label="Mail exchanger"
        value="mail.example.com"
        explain={explain}
        detailLevel="standard"
        kind="hostname"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("mail.example.com"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "mail.example.com",
      recordTypes: ["A", "AAAA"],
    });
  });

  it("renders plain text when onFollowUp is not supplied", () => {
    render(
      <LabeledField
        label="IPv4 address"
        value="93.184.216.34"
        explain={explain}
        detailLevel="standard"
        kind="ip-address"
      />
    );

    expect(screen.getByText("93.184.216.34")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render a follow-up trigger for a placeholder hostname value", () => {
    const onFollowUp = vi.fn();
    render(
      <LabeledField
        label="Target"
        value="."
        explain={explain}
        detailLevel="standard"
        kind="hostname"
        onFollowUp={onFollowUp}
      />
    );

    expect(screen.getByText(".")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render a follow-up trigger for an empty hostname value", () => {
    const onFollowUp = vi.fn();
    const { container } = render(
      <LabeledField
        label="Target"
        value=""
        explain={explain}
        detailLevel="standard"
        kind="hostname"
        onFollowUp={onFollowUp}
      />
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".rr-field__value-item")).toBeTruthy();
  });

  it("renders a decoded mailto link for an email-encoded field", () => {
    render(
      <LabeledField
        label="Responsible party"
        value="hostmaster.example.com"
        explain={explain}
        detailLevel="standard"
        kind="email-encoded"
        decode={() => "hostmaster@example.com"}
      />
    );

    expect(screen.getByText("hostmaster.example.com")).toBeTruthy();
    const link = screen.getByText("hostmaster@example.com");
    expect(link.getAttribute("href")).toBe("mailto:hostmaster@example.com");
  });

  it("omits the mailto link when the value cannot be decoded", () => {
    render(
      <LabeledField
        label="Responsible party"
        value="not-decodable"
        explain={explain}
        detailLevel="standard"
        kind="email-encoded"
        decode={() => null}
      />
    );

    expect(screen.getByText("not-decodable")).toBeTruthy();
    expect(screen.queryByText("mailto:", { exact: false })).toBeNull();
  });
});
