import { describeRecordResult } from "./formatRecordResult.js";

export function RecordResultCard({ result, domain }) {
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
