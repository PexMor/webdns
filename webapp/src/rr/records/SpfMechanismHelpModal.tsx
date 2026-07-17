import { useEffect, useRef } from "preact/hooks";
import type { SpfMechanismHelp } from "./spfHelp";

export interface SpfMechanismHelpModalProps {
  help: SpfMechanismHelp | null;
  onClose: () => void;
}

export function SpfMechanismHelpModal({ help, onClose }: SpfMechanismHelpModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!help) return;

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
  }, [help, onClose]);

  if (!help) return null;

  function handleOverlayClick(event: MouseEvent) {
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
        class="help-panel spf-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spf-mechanism-help-title"
      >
        <header class="help-panel__header">
          <h2 id="spf-mechanism-help-title">{help.title}</h2>
          <button type="button" class="help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p class="help-panel__body">{help.description}</p>
        <footer class="help-panel__footer">
          <button type="button" class="help-dismiss" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}
