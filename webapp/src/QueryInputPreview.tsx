import { useEffect, useRef, useState } from "preact/hooks";
import {
  engagedConvention,
  transformQueryInput,
  type ConventionId,
  type SrvFields,
  type TlsaFields,
  type TransformResult,
} from "./queryTransforms";
import { RECORD_TYPE_CONVENTION } from "./recordTypes";

export interface QueryInputPreviewProps {
  id: string;
  domain: string;
  onDomainChange: (value: string) => void;
  recordTypes: string[];
  enumMode: boolean;
  srvFields: SrvFields;
  tlsaFields: TlsaFields;
  /** Reports the resolved transform result as it changes, so the parent form
   *  can proactively disable submission while the engaged convention's input
   *  is invalid, instead of only surfacing the error after a submit attempt.
   *  Called with `null` when no convention is engaged (nothing to block on). */
  onResultChange?: (result: TransformResult | null) => void;
}

const CONVENTION_HINTS: Record<ConventionId, { label: string; placeholder: string }> = {
  "reverse-dns": { label: "IPv4 or IPv6 address", placeholder: "8.8.4.4" },
  enum: { label: "Phone number", placeholder: "+1-800-555-1234" },
  srv: { label: "Domain", placeholder: "example.com" },
  tlsa: { label: "Domain (or paste a URL)", placeholder: "example.com or https://example.com" },
  openpgpkey: { label: "Email address", placeholder: "alice@example.com" },
  smimea: { label: "Email address", placeholder: "alice@example.com" },
};

const DEFAULT_HINT = { label: "Domain", placeholder: "example.com" };

/** Shown below the input when a convention-capable record type is selected
 *  but its transform isn't engaged yet — explains what to type (or which
 *  extra field to fill in) to trigger it, with a worked example, so the
 *  transform is discoverable before the input becomes valid for it. */
const PENDING_HINTS: Record<ConventionId, { text: string; example: { input: string; queryName: string } }> = {
  "reverse-dns": {
    text: "Enter an IPv4 or IPv6 address to run a reverse-DNS (PTR) lookup instead of a literal name query.",
    example: { input: "8.8.4.4", queryName: "4.4.8.8.in-addr.arpa" },
  },
  enum: {
    text: "Enable ENUM mode above and enter a phone number to look it up under e164.arpa instead of a literal name query.",
    example: { input: "+1-800-555-1234", queryName: "4.3.2.1.5.5.5.0.0.8.1.e164.arpa" },
  },
  srv: {
    text: "Fill in the Service and Protocol fields above to build an SRV owner name instead of a literal name query.",
    example: { input: "sip + tcp + example.com", queryName: "_sip._tcp.example.com" },
  },
  tlsa: {
    text: "Fill in the Port and Transport fields above (or paste a URL here) to build a TLSA owner name instead of a literal name query.",
    example: { input: "https://example.com", queryName: "_443._tcp.example.com" },
  },
  openpgpkey: {
    text: "Enter an email address to look up its OpenPGP key by hash instead of a literal name query.",
    example: {
      input: "hugh@example.com",
      queryName: "c93f1e400f26708f98cb19d936620da35eec8f72e57f9eec01c1afd6._openpgpkey.example.com",
    },
  },
  smimea: {
    text: "Enter an email address to look up its S/MIME cert by hash instead of a literal name query.",
    example: {
      input: "hugh@example.com",
      queryName: "c93f1e400f26708f98cb19d936620da35eec8f72e57f9eec01c1afd6._smimecert.example.com",
    },
  },
};

/** Domain input for the lookup form: adapts its label/placeholder to the
 *  engaged lookup convention (if any) and shows a live "will query" preview
 *  or inline validation error underneath. */
export function QueryInputPreview({
  id,
  domain,
  onDomainChange,
  recordTypes,
  enumMode,
  srvFields,
  tlsaFields,
  onResultChange,
}: QueryInputPreviewProps) {
  const convention = engagedConvention({ recordTypes, domain, enumMode, srvFields, tlsaFields });
  const hint = convention ? CONVENTION_HINTS[convention] : DEFAULT_HINT;

  const [result, setResult] = useState<TransformResult | null>(null);
  const generationRef = useRef(0);
  const onResultChangeRef = useRef(onResultChange);
  onResultChangeRef.current = onResultChange;

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!convention) {
      setResult(null);
      onResultChangeRef.current?.(null);
      return;
    }
    transformQueryInput({ recordTypes, domain, enumMode, srvFields, tlsaFields }).then((next) => {
      if (generationRef.current !== generation) return;
      setResult(next);
      onResultChangeRef.current?.(next);
    });
  }, [
    convention,
    domain,
    recordTypes.join(","),
    enumMode,
    srvFields.service,
    srvFields.protocol,
    tlsaFields.port,
    tlsaFields.transport,
  ]);

  // Convention-capable types that are selected but not yet engaged: surfaced
  // as a discoverability hint (with example) rather than staying silent.
  const pendingConventions = convention
    ? []
    : Array.from(
        new Set(
          recordTypes
            .map((type) => RECORD_TYPE_CONVENTION[type])
            .filter((id): id is ConventionId => Boolean(id))
        )
      );

  return (
    <>
      <label for={id}>{hint.label}</label>
      <input
        id={id}
        type="text"
        placeholder={hint.placeholder}
        autocomplete="off"
        required
        value={domain}
        onInput={(e) => onDomainChange((e.currentTarget as HTMLInputElement).value)}
      />
      {convention &&
        result &&
        ("error" in result ? (
          <p class="query-input-preview__error" role="alert">
            {result.error}
          </p>
        ) : (
          <p class="query-input-preview__hint">
            Will query: <code>{result.queryName}</code>
          </p>
        ))}
      {pendingConventions.length > 0 && (
        <div class="query-input-preview__pending">
          {pendingConventions.map((id) => (
            <p key={id} class="query-input-preview__hint query-input-preview__hint--pending">
              {PENDING_HINTS[id].text}
              <span class="query-input-preview__example">
                <code>{PENDING_HINTS[id].example.input}</code>
                {" → "}
                <code>{PENDING_HINTS[id].example.queryName}</code>
              </span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
