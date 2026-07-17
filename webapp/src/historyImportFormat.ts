/** Parse a history export file body (JSON array or NDJSON/JSONL). */
export function parseImportedHistoryText(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not a single JSON array — fall through to NDJSON/JSONL parsing below.
  }

  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    });
}
