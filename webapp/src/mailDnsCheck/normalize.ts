/** Sort, trim, and drop blank lines — mirrors the shell script's normalize_file. */
export function normalizeRecordLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

/** True when every group of lines normalizes to the same content. */
export function recordsMatch(groups: string[][]): boolean {
  if (groups.length === 0) return true;
  const base = normalizeRecordLines(groups[0]).join("\n");
  return groups.every((group) => normalizeRecordLines(group).join("\n") === base);
}

/** Keep only TXT lines that contain v=spf1 (case-insensitive). */
export function extractSpfLines(txtRecords: string[]): string[] {
  return txtRecords.filter((line) => /v=spf1/i.test(line));
}

/** Strip trailing dot and compare hostnames case-insensitively. */
export function hostnameMatch(a: string, b: string): boolean {
  const strip = (value: string) => value.replace(/\.$/, "").toLowerCase();
  return strip(a) === strip(b);
}

export function stripTrailingDot(value: string): string {
  return value.replace(/\.$/, "");
}
