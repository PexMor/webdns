import { useEffect, useRef, useState } from "preact/hooks";
import { extractExampleRdata, getRecordTypeHelp } from "./recordTypeHelp";
import { getRrTypeEntry } from "./rr";
import type { DetailLevel } from "./rr";
import type { RrViewMode } from "./rrViewPrefsStore";

export interface RecordTypeHelpModalProps {
  recordType: string | null;
  onClose: () => void;
  defaultViewMode: RrViewMode;
  detailLevel: DetailLevel;
}

export function RecordTypeHelpModal({
  recordType,
  onClose,
  defaultViewMode,
  detailLevel,
}: RecordTypeHelpModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const help = getRecordTypeHelp(recordType ?? "");
  const [viewMode, setViewMode] = useState<RrViewMode>(defaultViewMode);

  useEffect(() => {
    setViewMode(defaultViewMode);
  }, [recordType, defaultViewMode]);

  useEffect(() => {
    if (!recordType) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [recordType, onClose]);

  if (!recordType) return null;

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === overlayRef.current) onClose();
  }

  const entry = getRrTypeEntry(recordType);
  const rdata = help.example ? extractExampleRdata(help.example) : null;
  const parsed = entry && rdata ? entry.parse(rdata) : null;
  const canShowParsed = Boolean(entry && parsed);

  return (
    <div
      class="help-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        class="help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-type-help-title"
      >
        <header class="help-panel__header">
          <h2 id="record-type-help-title">{help.title}</h2>
          <button
            type="button"
            class="help-close"
            onClick={onClose}
            aria-label="Close help"
          >
            ×
          </button>
        </header>
        <p class="help-panel__body">{help.description}</p>
        {help.example && (
          <div class="help-panel__example">
            <div class="help-panel__example-header">
              <p class="help-panel__example-label">Example</p>
              {canShowParsed && (
                <button
                  type="button"
                  class="rr-view-toggle"
                  onClick={() => setViewMode((mode) => (mode === "parsed" ? "raw" : "parsed"))}
                >
                  {viewMode === "parsed" ? "Show raw" : "Show parsed"}
                </button>
              )}
            </div>
            {canShowParsed && viewMode === "parsed" && entry && parsed ? (
              <entry.View fields={entry.fields} detailLevel={detailLevel} value={parsed} />
            ) : (
              <pre class="help-panel__example-value">{help.example}</pre>
            )}
          </div>
        )}
        {help.transformExample && (
          <div class="help-panel__transform-example">
            <p class="help-panel__example-label">Query name from user input</p>
            <p class="help-panel__transform-example-value">
              <code>{help.transformExample.input}</code>
              {" → "}
              <code>{help.transformExample.queryName}</code>
            </p>
          </div>
        )}
        <footer class="help-panel__footer">
          <button type="button" class="help-dismiss" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}
