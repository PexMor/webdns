import { useEffect, useRef, useState } from "preact/hooks";
import { copyToClipboard } from "./copyToClipboard";
import { formatCliHints } from "./formatCliHints";

export interface RecordCliHintModalProps {
  open: boolean;
  onClose: () => void;
  recordType: string;
  domain: string;
  dnsServerResolved?: string;
}

function CliCommandBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(command);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div class="help-panel__example">
      <div class="help-panel__example-header">
        <p class="help-panel__example-label">{label}</p>
        <button
          type="button"
          class="cli-copy-button"
          onClick={handleCopy}
          aria-label={`Copy ${label} command`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre class="help-panel__example-value">{command}</pre>
    </div>
  );
}

export function RecordCliHintModal({
  open,
  onClose,
  recordType,
  domain,
  dnsServerResolved,
}: RecordCliHintModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const hints = formatCliHints({ recordType, domain, dnsServerResolved });

  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  if (!open) return null;

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
        class="help-panel cli-hint-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cli-hint-title"
      >
        <header class="help-panel__header">
          <h2 id="cli-hint-title">Command line</h2>
          <button type="button" class="help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p class="help-panel__body">
          Run the same lookup locally. These examples query{" "}
          <strong>
            {recordType} for {domain}
          </strong>
          {dnsServerResolved ? (
            <>
              {" "}
              using resolver <strong>{dnsServerResolved}</strong>
            </>
          ) : (
            <> using your system&apos;s default resolver</>
          )}
          .
        </p>
        <CliCommandBlock label="dig (Linux, macOS, BIND)" command={hints.dig} />
        <CliCommandBlock label="nslookup (Windows)" command={hints.nslookup} />
        <p class="cli-hint-panel__note">
          Omit <code>+short</code> from the <code>dig</code> command to see the full response with
          headers and TTL.
        </p>
        <footer class="help-panel__footer">
          <button type="button" class="help-dismiss" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}
