import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
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
