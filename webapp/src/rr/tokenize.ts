/**
 * Splits a DNS RDATA presentation-format string into tokens: whitespace
 * separates tokens, double-quoted character-strings (with `\"` escaping)
 * become a single token with quotes stripped, and cosmetic parentheses used
 * for line-wrapping (as in SOA/DNSKEY/RRSIG-style records) are dropped.
 */
export function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  const s = raw.trim();
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(" || ch === ")") {
      i++;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let value = "";
      while (j < s.length && s[j] !== '"') {
        if (s[j] === "\\" && j + 1 < s.length) {
          value += s[j + 1];
          j += 2;
        } else {
          value += s[j];
          j++;
        }
      }
      tokens.push(value);
      i = j + 1;
      continue;
    }

    let j = i;
    while (j < s.length && !/\s/.test(s[j]) && s[j] !== "(" && s[j] !== ")") {
      j++;
    }
    tokens.push(s.slice(i, j));
    i = j;
  }

  return tokens;
}

export function isInteger(token: string | undefined): token is string {
  return token !== undefined && /^-?\d+$/.test(token);
}

/**
 * Splits `tokens` into a fixed number of positional leading tokens plus the
 * remainder, or returns `null` if there aren't enough tokens.
 */
export function takePositional(
  tokens: string[],
  count: number
): { head: string[]; rest: string[] } | null {
  if (tokens.length < count) return null;
  return { head: tokens.slice(0, count), rest: tokens.slice(count) };
}

/** Joins the remaining tokens of a blob-like field (base64/hex material)
 *  back together, undoing any incidental line-wrap splitting. */
export function joinBlob(tokens: string[]): string {
  return tokens.join("");
}
