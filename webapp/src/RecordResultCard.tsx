import { describeRecordResult } from "./formatRecordResult";
import type { DnsRecordResult } from "./types";

export interface RecordResultCardProps {
  result: DnsRecordResult;
  domain: string;
}

export function RecordResultCard({ result, domain }: RecordResultCardProps) {
  const { kind, message, records } = describeRecordResult(result, domain);

  return (
    <div class={`record-card record-card--${kind}`}>
      <h3>
        {result.record_type} — {domain}
      </h3>
      {kind === "success" ? (
        <ul>
          {records.map((record) => (
            <li key={record}>{record}</li>
          ))}
        </ul>
      ) : (
        <p class={kind === "error" ? "record-message record-message--error" : "record-message"}>
          {message}
        </p>
      )}
    </div>
  );
}
