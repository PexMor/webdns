import type { SrvFields, TlsaFields } from "./queryTransforms";

export interface SrvFieldsInputProps {
  value: SrvFields;
  onChange: (value: SrvFields) => void;
}

/** Optional Service/Protocol inputs for SRV: filling either one engages the
 *  `_service._protocol.domain` convention; left blank, SRV queries the
 *  literal domain as any other record type does. */
export function SrvFieldsInput({ value, onChange }: SrvFieldsInputProps) {
  return (
    <div class="convention-fields">
      <label for="srv-service">Service (optional)</label>
      <input
        id="srv-service"
        type="text"
        placeholder="sip"
        autocomplete="off"
        value={value.service}
        onInput={(e) => onChange({ ...value, service: (e.currentTarget as HTMLInputElement).value })}
      />
      <label for="srv-protocol">Protocol (optional)</label>
      <input
        id="srv-protocol"
        type="text"
        placeholder="tcp"
        autocomplete="off"
        value={value.protocol}
        onInput={(e) => onChange({ ...value, protocol: (e.currentTarget as HTMLInputElement).value })}
      />
    </div>
  );
}

export interface TlsaFieldsInputProps {
  value: TlsaFields;
  onChange: (value: TlsaFields) => void;
}

/** Optional Port/Transport inputs for TLSA: filling either one engages the
 *  `_port._transport.domain` convention; left blank (and the domain isn't a
 *  pasted URL), TLSA queries the literal domain as any other record type does. */
export function TlsaFieldsInput({ value, onChange }: TlsaFieldsInputProps) {
  return (
    <div class="convention-fields">
      <label for="tlsa-port">Port (optional)</label>
      <input
        id="tlsa-port"
        type="text"
        inputmode="numeric"
        placeholder="443"
        autocomplete="off"
        value={value.port}
        onInput={(e) => onChange({ ...value, port: (e.currentTarget as HTMLInputElement).value })}
      />
      <label for="tlsa-transport">Transport (optional)</label>
      <input
        id="tlsa-transport"
        type="text"
        placeholder="tcp"
        autocomplete="off"
        value={value.transport}
        onInput={(e) => onChange({ ...value, transport: (e.currentTarget as HTMLInputElement).value })}
      />
    </div>
  );
}
