/**
 * Turn a per-record-type DNS result into a display-friendly shape.
 *
 * @returns {{ kind: "success" | "empty" | "error", message: string | null, records: string[] }}
 */
export function describeRecordResult(result, domain) {
  const type = result.record_type;
  const records = result.records ?? [];

  if (records.length > 0) {
    return { kind: "success", message: null, records };
  }

  if (result.error) {
    return {
      kind: "error",
      message: humanizeLookupError(result.error, type, domain),
      records: [],
    };
  }

  return {
    kind: "empty",
    message: `No ${type} records are published for ${domain}.`,
    records: [],
  };
}

/** Humanize top-level WebSocket / request errors. */
export function humanizeRequestError(error) {
  if (!error) return null;

  const lower = error.toLowerCase();
  if (lower.includes("invalid dns server address")) {
    return "The DNS resolver address is invalid. Check it in Settings.";
  }
  if (lower.includes("failed to configure resolver")) {
    return "Could not use the selected DNS resolver. Check the address in Settings.";
  }

  return error;
}

function humanizeLookupError(error, type, domain) {
  const lower = error.toLowerCase();

  if (lower.includes("does not exist")) {
    return error;
  }
  if (lower.includes("not a supported dns record type")) {
    return error;
  }
  if (lower.includes("timed out")) {
    return "The lookup timed out. Try again or choose a different resolver.";
  }
  if (lower.includes("temporary error")) {
    return error;
  }
  if (lower.includes("refused this query")) {
    return error;
  }
  if (lower.includes("no records found")) {
    return `No ${type} records are published for ${domain}.`;
  }

  return error;
}
