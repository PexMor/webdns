import { useEffect, useRef } from "preact/hooks";
import { getRecordTypeHelp } from "./recordTypeHelp.js";

export function RecordTypeHelpModal({ recordType, onClose }) {
  const overlayRef = useRef(null);
  const help = getRecordTypeHelp(recordType);

  useEffect(() => {
    if (!recordType) return;

    function handleKey(event) {
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

  function handleOverlayClick(event) {
    if (event.target === overlayRef.current) onClose();
  }

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
            <p class="help-panel__example-label">Example</p>
            <pre class="help-panel__example-value">{help.example}</pre>
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
