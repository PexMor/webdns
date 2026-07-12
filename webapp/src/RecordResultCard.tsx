import { useState } from "preact/hooks";
import { describeRecordResult } from "./formatRecordResult";
import { GenericView } from "./rr/GenericView";
import { getRrTypeEntry } from "./rr";
import type { DetailLevel } from "./rr";
import type { RrViewMode } from "./rrViewPrefsStore";
import type { DnsRecordResult } from "./types";

export interface RecordResultCardProps {
  result: DnsRecordResult;
  domain: string;
  defaultViewMode: RrViewMode;
  detailLevel: DetailLevel;
}

export function RecordResultCard({
  result,
  domain,
  defaultViewMode,
  detailLevel,
}: RecordResultCardProps) {
  const { kind, message, records } = describeRecordResult(result, domain);
  const entry = getRrTypeEntry(result.record_type);
  const [viewMode, setViewMode] = useState<RrViewMode>(defaultViewMode);

  return (
    <div class={`record-card record-card--${kind}`}>
      <div class="record-card__header">
        <h3>
          {result.record_type} — {domain}
        </h3>
        {kind === "success" && entry && (
          <button
            type="button"
            class="rr-view-toggle"
            onClick={() => setViewMode((mode) => (mode === "parsed" ? "raw" : "parsed"))}
          >
            {viewMode === "parsed" ? "Show raw" : "Show parsed"}
          </button>
        )}
      </div>
      {kind === "success" ? (
        <div class="rr-records">
          {records.map((record, index) => (
            <RrRecordView
              key={`${index}-${record}`}
              raw={record}
              recordType={result.record_type}
              viewMode={viewMode}
              detailLevel={detailLevel}
            />
          ))}
        </div>
      ) : (
        <p class={kind === "error" ? "record-message record-message--error" : "record-message"}>
          {message}
        </p>
      )}
    </div>
  );
}

interface RrRecordViewProps {
  raw: string;
  recordType: string;
  viewMode: RrViewMode;
  detailLevel: DetailLevel;
}

function RrRecordView({ raw, recordType, viewMode, detailLevel }: RrRecordViewProps) {
  const entry = getRrTypeEntry(recordType);

  if (viewMode === "raw" || !entry) {
    return <GenericView raw={raw} />;
  }

  const parsed = entry.parse(raw);
  if (!parsed) {
    return <GenericView raw={raw} />;
  }

  const View = entry.View;
  return <View fields={entry.fields} detailLevel={detailLevel} value={parsed} />;
}
