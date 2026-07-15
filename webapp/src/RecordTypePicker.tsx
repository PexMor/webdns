import { useEffect, useRef } from "preact/hooks";
import { RecordTypeGroups } from "./RecordTypeGroups";

export interface RecordTypePickerProps {
  selectedTypes: Set<string>;
  toggleType: (type: string) => void;
  isRecordTypeCheckboxDisabled: (type: string) => boolean;
  recordTypeTitle: (type: string) => string | undefined;
  onOpenHelp: (type: string) => void;
  onClose: () => void;
}

export function RecordTypePicker({
  selectedTypes,
  toggleType,
  isRecordTypeCheckboxDisabled,
  recordTypeTitle,
  onOpenHelp,
  onClose,
}: RecordTypePickerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === overlayRef.current) onClose();
  }

  return (
    <div class="menu-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div class="menu-panel" role="dialog" aria-modal="true" aria-label="Select record types">
        <header class="menu-panel__header">
          <h2>Record types</h2>
          <button type="button" class="menu-close" onClick={onClose} aria-label="Close record type picker">
            ×
          </button>
        </header>

        <RecordTypeGroups
          selectedTypes={selectedTypes}
          toggleType={toggleType}
          isRecordTypeCheckboxDisabled={isRecordTypeCheckboxDisabled}
          recordTypeTitle={recordTypeTitle}
          onOpenHelp={onOpenHelp}
        />

        <footer class="record-type-picker__footer">
          <button type="button" class="record-type-picker__done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
