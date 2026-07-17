import { useState } from "preact/hooks";
import { describeRecordResult } from "./formatRecordResult";
import { GenericView } from "./rr/GenericView";
import { getRrTypeEntry } from "./rr";
import type { DetailLevel, FollowUpQuery } from "./rr";
import type { RrViewMode } from "./rrViewPrefsStore";
import type { DnsRecordResult } from "./types";
import { RecordCliHintModal } from "./RecordCliHintModal";

export interface RecordResultCardProps {
  result: DnsRecordResult;
  domain: string;
  defaultViewMode: RrViewMode;
  detailLevel: DetailLevel;
  dnsServerResolved?: string;
  onFollowUp?: (query: FollowUpQuery) => void;
}

export function RecordResultCard({
  result,
  domain,
  defaultViewMode,
  detailLevel,
  dnsServerResolved,
  onFollowUp,
}: RecordResultCardProps) {
  const { kind, message, records } = describeRecordResult(result, domain);
  const entry = getRrTypeEntry(result.record_type);
  const [viewMode, setViewMode] = useState<RrViewMode>(defaultViewMode);
  const [cliHintOpen, setCliHintOpen] = useState(false);

  return (
    <div class={`record-card record-card--${kind}`}>
      <div class="record-card__header">
        <h3>
          {result.record_type} — {domain}
        </h3>
        <div class="record-card__actions">
          {kind === "success" && entry && (
            <button
              type="button"
              class="rr-view-toggle"
              onClick={() => setViewMode((mode) => (mode === "parsed" ? "raw" : "parsed"))}
            >
              {viewMode === "parsed" ? "Show raw" : "Show parsed"}
            </button>
          )}
          <button
            type="button"
            class="rr-view-toggle rr-cli-toggle"
            onClick={() => setCliHintOpen(true)}
            aria-label="Show command-line lookup examples"
            title="Command line"
          >
            &gt;_
          </button>
        </div>
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
              onFollowUp={onFollowUp}
            />
          ))}
        </div>
      ) : (
        <p class={kind === "error" ? "record-message record-message--error" : "record-message"}>
          {message}
        </p>
      )}
      <RecordCliHintModal
        open={cliHintOpen}
        onClose={() => setCliHintOpen(false)}
        recordType={result.record_type}
        domain={domain}
        dnsServerResolved={dnsServerResolved}
      />
    </div>
  );
}

interface RrRecordViewProps {
  raw: string;
  recordType: string;
  viewMode: RrViewMode;
  detailLevel: DetailLevel;
  onFollowUp?: (query: FollowUpQuery) => void;
}

function RrRecordView({ raw, recordType, viewMode, detailLevel, onFollowUp }: RrRecordViewProps) {
  const entry = getRrTypeEntry(recordType);

  if (viewMode === "raw" || !entry) {
    return <GenericView raw={raw} />;
  }

  const parsed = entry.parse(raw);
  if (!parsed) {
    return <GenericView raw={raw} />;
  }

  const View = entry.View;
  return (
    <View fields={entry.fields} detailLevel={detailLevel} value={parsed} onFollowUp={onFollowUp} />
  );
}
