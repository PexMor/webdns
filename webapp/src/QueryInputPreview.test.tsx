import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryInputPreview } from "./QueryInputPreview";
import { DEFAULT_SRV_FIELDS, DEFAULT_TLSA_FIELDS } from "./queryTransforms";

afterEach(cleanup);

function renderPreview(overrides: Partial<Parameters<typeof QueryInputPreview>[0]> = {}) {
  const onDomainChange = vi.fn();
  const props = {
    id: "domain",
    domain: "",
    onDomainChange,
    recordTypes: ["A"],
    enumMode: false,
    srvFields: DEFAULT_SRV_FIELDS,
    tlsaFields: DEFAULT_TLSA_FIELDS,
    ...overrides,
  };
  render(<QueryInputPreview {...props} />);
  return { onDomainChange };
}

describe("QueryInputPreview", () => {
  it("shows the default domain label and no preview when nothing is engaged", () => {
    renderPreview({ recordTypes: ["A", "MX"], domain: "example.com" });
    expect(screen.getByLabelText("Domain")).toBeTruthy();
    expect(screen.queryByText(/Will query/)).toBeNull();
  });

  it("switches to address mode and previews the PTR query name for a valid IP", async () => {
    renderPreview({ recordTypes: ["PTR"], domain: "8.8.4.4" });
    expect(screen.getByLabelText("IPv4 or IPv6 address")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Will query/)).toBeTruthy());
    expect(screen.getByText("4.4.8.8.in-addr.arpa")).toBeTruthy();
  });

  it("does not preview PTR for an ordinary hostname", () => {
    renderPreview({ recordTypes: ["PTR"], domain: "example.com" });
    expect(screen.getByLabelText("Domain")).toBeTruthy();
    expect(screen.queryByText(/Will query/)).toBeNull();
  });

  it("shows the ENUM preview only when enumMode is on", async () => {
    const { rerender } = render(
      <QueryInputPreview
        id="domain"
        domain="1-800-555-1234"
        onDomainChange={() => {}}
        recordTypes={["NAPTR"]}
        enumMode={false}
        srvFields={DEFAULT_SRV_FIELDS}
        tlsaFields={DEFAULT_TLSA_FIELDS}
      />
    );
    expect(screen.queryByText(/Will query/)).toBeNull();

    rerender(
      <QueryInputPreview
        id="domain"
        domain="1-800-555-1234"
        onDomainChange={() => {}}
        recordTypes={["NAPTR"]}
        enumMode={true}
        srvFields={DEFAULT_SRV_FIELDS}
        tlsaFields={DEFAULT_TLSA_FIELDS}
      />
    );
    expect(screen.getByLabelText("Phone number")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("4.3.2.1.5.5.5.0.0.8.1.e164.arpa")).toBeTruthy());
  });

  it("previews the SRV owner name once service/protocol fields are filled", async () => {
    renderPreview({
      recordTypes: ["SRV"],
      domain: "example.com",
      srvFields: { service: "sip", protocol: "tcp" },
    });
    await waitFor(() => expect(screen.getByText("_sip._tcp.example.com")).toBeTruthy());
  });

  it("does not preview SRV when the fields are blank", () => {
    renderPreview({ recordTypes: ["SRV"], domain: "example.com" });
    expect(screen.queryByText(/Will query/)).toBeNull();
  });

  it("previews the TLSA owner name once port/transport fields are filled", async () => {
    renderPreview({
      recordTypes: ["TLSA"],
      domain: "example.com",
      tlsaFields: { port: "443", transport: "tcp" },
    });
    await waitFor(() => expect(screen.getByText("_443._tcp.example.com")).toBeTruthy());
  });

  it("does not preview TLSA when the fields are blank and domain isn't a URL", () => {
    renderPreview({ recordTypes: ["TLSA"], domain: "example.com" });
    expect(screen.queryByText(/Will query/)).toBeNull();
  });

  it("switches to email-address mode for OPENPGPKEY on email-shaped input", () => {
    renderPreview({ recordTypes: ["OPENPGPKEY"], domain: "alice@example.com" });
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("does not engage OPENPGPKEY for a plain hostname", () => {
    renderPreview({ recordTypes: ["OPENPGPKEY"], domain: "example.com" });
    expect(screen.getByLabelText("Domain")).toBeTruthy();
    expect(screen.queryByText(/Will query/)).toBeNull();
  });

  it("calls onDomainChange when the input changes", () => {
    const { onDomainChange } = renderPreview({ recordTypes: ["A"], domain: "" });
    fireEvent.input(screen.getByLabelText("Domain"), { target: { value: "example.com" } });
    expect(onDomainChange).toHaveBeenCalledWith("example.com");
  });

  it("reports null via onResultChange when no convention is engaged", () => {
    const onResultChange = vi.fn();
    renderPreview({ recordTypes: ["A", "MX"], domain: "example.com", onResultChange });
    expect(onResultChange).toHaveBeenCalledWith(null);
  });

  it("reports a success result via onResultChange once the PTR transform resolves", async () => {
    const onResultChange = vi.fn();
    renderPreview({ recordTypes: ["PTR"], domain: "8.8.4.4", onResultChange });
    await waitFor(() =>
      expect(onResultChange).toHaveBeenCalledWith({ queryName: "4.4.8.8.in-addr.arpa" })
    );
  });

  it("reports an error result via onResultChange when the engaged convention's input is invalid", async () => {
    const onResultChange = vi.fn();
    renderPreview({
      recordTypes: ["NAPTR"],
      domain: "no-digits-here",
      enumMode: true,
      onResultChange,
    });
    await waitFor(() => {
      const lastCall = onResultChange.mock.calls.at(-1)?.[0];
      expect(lastCall).toEqual({ error: expect.any(String) });
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("shows a pending-transform hint with an example when PTR is selected but not yet engaged", () => {
    renderPreview({ recordTypes: ["PTR"], domain: "example.com" });
    expect(screen.getByText(/Enter an IPv4 or IPv6 address/)).toBeTruthy();
    expect(screen.getByText("8.8.4.4")).toBeTruthy();
    expect(screen.getByText("4.4.8.8.in-addr.arpa")).toBeTruthy();
  });

  it("shows a pending-transform hint for NAPTR when ENUM mode is off", () => {
    renderPreview({ recordTypes: ["NAPTR"], domain: "example.com", enumMode: false });
    expect(screen.getByText(/Enable ENUM mode/)).toBeTruthy();
  });

  it("shows a pending-transform hint for SRV/TLSA/OPENPGPKEY with blank fields", () => {
    renderPreview({ recordTypes: ["SRV"], domain: "example.com" });
    expect(screen.getByText(/Fill in the Service and Protocol fields/)).toBeTruthy();
  });

  it("does not show a pending-transform hint for plain record types", () => {
    renderPreview({ recordTypes: ["A", "MX"], domain: "example.com" });
    expect(screen.queryByText(/Enter an IPv4 or IPv6 address/)).toBeNull();
    expect(screen.queryByText(/Enable ENUM mode/)).toBeNull();
  });

  it("hides the pending-transform hint once the convention actually engages", async () => {
    renderPreview({ recordTypes: ["PTR"], domain: "8.8.4.4" });
    expect(screen.queryByText(/Enter an IPv4 or IPv6 address/)).toBeNull();
    await waitFor(() => expect(screen.getByText(/Will query/)).toBeTruthy());
  });

  it("shows a pending hint per selected convention type when more than one is selected", () => {
    renderPreview({ recordTypes: ["PTR", "OPENPGPKEY"], domain: "example.com" });
    expect(screen.getByText(/Enter an IPv4 or IPv6 address/)).toBeTruthy();
    expect(screen.getByText(/look up its OpenPGP key by hash/)).toBeTruthy();
  });
});
