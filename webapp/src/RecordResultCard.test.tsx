import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordResultCard } from "./RecordResultCard";
import type { DnsRecordResult } from "./types";

afterEach(cleanup);

describe("RecordResultCard", () => {
  it("renders a parsed view for a registered, parseable record type", () => {
    const result: DnsRecordResult = {
      record_type: "MX",
      records: ["10 mail.example.com."],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    expect(screen.getByText("Mail exchanger")).toBeTruthy();
    expect(screen.getByText("mail.example.com.")).toBeTruthy();
    expect(screen.getByText("Show raw")).toBeTruthy();
  });

  it("opens command-line hints in a modal", () => {
    const result: DnsRecordResult = {
      record_type: "MX",
      records: ["10 mail.example.com."],
    };
    render(
      <RecordResultCard
        result={result}
        domain="nasoutez.eu"
        defaultViewMode="parsed"
        detailLevel="standard"
        dnsServerResolved="1.1.1.1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show command-line lookup examples" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("dig (Linux, macOS, BIND)")).toBeTruthy();
    expect(screen.getByText("dig @1.1.1.1 MX +short nasoutez.eu")).toBeTruthy();
    expect(screen.getByText("nslookup -type=MX nasoutez.eu 1.1.1.1")).toBeTruthy();
  });

  it("toggles a parsed record to its raw string and back", () => {
    const result: DnsRecordResult = {
      record_type: "MX",
      records: ["10 mail.example.com."],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    fireEvent.click(screen.getByText("Show raw"));
    expect(screen.getByText("10 mail.example.com.")).toBeTruthy();
    expect(screen.queryByText("Mail exchanger")).toBeNull();

    fireEvent.click(screen.getByText("Show parsed"));
    expect(screen.getByText("Mail exchanger")).toBeTruthy();
  });

  it("falls back to the raw value for an unregistered record type", () => {
    const result: DnsRecordResult = {
      record_type: "NOTAREALTYPE",
      records: ["some raw value"],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    expect(screen.getByText("some raw value")).toBeTruthy();
    expect(screen.queryByText("Show raw")).toBeNull();
  });

  it("falls back to the raw value when a registered parser rejects the string", () => {
    const result: DnsRecordResult = {
      record_type: "MX",
      records: ["not a valid mx record"],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    expect(screen.getByText("not a valid mx record")).toBeTruthy();
  });

  it("triggers a PTR follow-up when an A record's address is clicked", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "A",
      records: ["93.184.216.34"],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("93.184.216.34"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "93.184.216.34",
      recordTypes: ["PTR"],
    });
  });

  it("triggers an A+AAAA follow-up when an MX exchange hostname is clicked", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "MX",
      records: ["10 mail.example.com."],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("mail.example.com."));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "mail.example.com.",
      recordTypes: ["A", "AAAA"],
    });
  });

  it("does not trigger a follow-up for an SRV target placeholder value", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "SRV",
      records: ["0 0 0 ."],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    expect(screen.getByText(".")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "." })).toBeNull();
  });

  it("triggers an A+AAAA follow-up when an SPF a: mechanism hostname is clicked", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: [
        '"v=spf1 mx a:mail.natrenink.eu ip4:46.36.35.234 ip6:2a02:25b0:aaaa:21ca:: -all"',
      ],
    };
    render(
      <RecordResultCard
        result={result}
        domain="natrenink.eu"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("mail.natrenink.eu"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "mail.natrenink.eu",
      recordTypes: ["A", "AAAA"],
    });
  });

  it("triggers a TXT follow-up when an SPF include: mechanism domain is clicked", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: ['"v=spf1 include:_spf.mailersend.net ~all"'],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("_spf.mailersend.net"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "_spf.mailersend.net",
      recordTypes: ["TXT"],
    });
  });

  it("triggers a PTR follow-up when an SPF ip4: mechanism address is clicked", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: [
        '"v=spf1 mx a:mail.natrenink.eu ip4:46.36.35.234 ip6:2a02:25b0:aaaa:21ca:: -all"',
      ],
    };
    render(
      <RecordResultCard
        result={result}
        domain="natrenink.eu"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("46.36.35.234"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "46.36.35.234",
      recordTypes: ["PTR"],
    });
  });

  it("does not render bare SPF mechanisms or qualifiers as clickable follow-ups", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: [
        '"v=spf1 mx a:mail.natrenink.eu ip4:46.36.35.234 ip6:2a02:25b0:aaaa:21ca:: -all"',
      ],
    };
    const { container } = render(
      <RecordResultCard
        result={result}
        domain="natrenink.eu"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    expect(screen.queryByRole("button", { name: "mx" })).toBeNull();
    expect(screen.queryByRole("button", { name: "-all" })).toBeNull();
    expect(screen.getByRole("button", { name: "Explain mx" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explain -all" })).toBeTruthy();
    expect(container.querySelectorAll(".spf-term-line").length).toBe(6);
  });

  it("opens SPF mechanism help when a mechanism label is clicked", () => {
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: ['"v=spf1 mx include:_spf.example.com ~all"'],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Explain ~all" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "~all" })).toBeTruthy();
    expect(screen.getByText(/softfail/i)).toBeTruthy();
  });

  it("triggers a follow-up from an unquoted SPF string (as some backends return TXT rdata)", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: ["v=spf1 mx a:mail.natrenink.eu ip4:46.36.35.234 -all"],
    };
    render(
      <RecordResultCard
        result={result}
        domain="natrenink.eu"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("mail.natrenink.eu"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "mail.natrenink.eu",
      recordTypes: ["A", "AAAA"],
    });
  });

  it("does not treat plain (non-SPF) TXT text as interactive", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "TXT",
      records: ['"just some ordinary text"'],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    expect(screen.getByText("just some ordinary text")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "just some ordinary text" })).toBeNull();
  });

  it("triggers a PTR follow-up when an HTTPS ipv4hint address is clicked", () => {
    const onFollowUp = vi.fn();
    const result: DnsRecordResult = {
      record_type: "HTTPS",
      records: ['1 . alpn="h2,h3" ipv4hint=93.184.216.34,93.184.216.35'],
    };
    render(
      <RecordResultCard
        result={result}
        domain="example.com"
        defaultViewMode="parsed"
        detailLevel="standard"
        onFollowUp={onFollowUp}
      />
    );

    fireEvent.click(screen.getByText("93.184.216.34"));
    expect(onFollowUp).toHaveBeenCalledWith({
      domain: "93.184.216.34",
      recordTypes: ["PTR"],
    });

    expect(screen.queryByRole("button", { name: "h2,h3" })).toBeNull();
  });

  it("shows the error message for a failed lookup", () => {
    const result: DnsRecordResult = {
      record_type: "A",
      error: "The domain \"nope.invalid\" does not exist.",
    };
    render(
      <RecordResultCard
        result={result}
        domain="nope.invalid"
        defaultViewMode="parsed"
        detailLevel="standard"
      />
    );

    expect(screen.getByText('The domain "nope.invalid" does not exist.')).toBeTruthy();
  });
});
