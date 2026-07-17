/** One whitespace-separated term of an SPF (RFC 7208) record string, split
 *  into the parts needed to render it with its target value (a hostname or
 *  IP address) as a clickable follow-up, while the rest of the term (the
 *  qualifier, mechanism name, separator, and any CIDR suffix) renders as
 *  plain text around it. */
export interface SpfTerm {
  /** Text before the actionable value, e.g. `"-a:"`, `"ip4:"`, `"redirect="`. */
  prefix: string;
  /** The actionable value (a hostname or IP address), or `null` if this term
   *  has no actionable target (e.g. a bare `mx`, an `all` qualifier, or a
   *  macro-letter domain-spec such as `exists:%{i}.example.com`). */
  value: string | null;
  /** DNS record kind of `value`, or `null` when `value` is `null`. */
  kind: "hostname" | "ip-address" | "txt" | null;
  /** Text after the actionable value, e.g. a CIDR suffix like `"/24"`. */
  suffix: string;
  /** The full, unmodified term text — used for rendering when `value` is `null`. */
  raw: string;
}

const HOSTNAME_MECHANISMS = new Set(["a", "mx", "exists"]);
const TXT_MECHANISMS = new Set(["include"]);
const IP_MECHANISMS = new Set(["ip4", "ip6"]);

function nonActionable(raw: string): SpfTerm {
  return { prefix: "", value: null, kind: null, suffix: "", raw };
}

export function parseSpfTerm(term: string): SpfTerm {
  const qualifierMatch = /^[+\-~?]/.exec(term);
  const qualifier = qualifierMatch ? qualifierMatch[0] : "";
  const body = term.slice(qualifier.length);

  const redirectMatch = /^redirect=(.*)$/i.exec(body);
  if (redirectMatch) {
    const value = redirectMatch[1];
    if (!value || value.includes("%")) return nonActionable(term);
    return { prefix: `${qualifier}redirect=`, value, kind: "txt", suffix: "", raw: term };
  }

  const mechanismMatch = /^([a-zA-Z0-9-]+):(.*)$/.exec(body);
  if (mechanismMatch) {
    const [, name, rest] = mechanismMatch;
    const lowerName = name.toLowerCase();
    const kind = TXT_MECHANISMS.has(lowerName)
      ? "txt"
      : HOSTNAME_MECHANISMS.has(lowerName)
        ? "hostname"
        : IP_MECHANISMS.has(lowerName)
          ? "ip-address"
          : null;
    if (kind) {
      const slashIndex = rest.indexOf("/");
      const value = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
      const suffix = slashIndex === -1 ? "" : rest.slice(slashIndex);
      if (value && !value.includes("%")) {
        return { prefix: `${qualifier}${name}:`, value, kind, suffix, raw: term };
      }
    }
  }

  return nonActionable(term);
}

/** Parses an SPF (RFC 7208) record's text into terms, or `null` if the text
 *  isn't an SPF record (doesn't start with the `v=spf1` version term). */
export function parseSpfTerms(text: string): SpfTerm[] | null {
  const trimmed = text.trim();
  if (!/^v=spf1(\s|$)/i.test(trimmed)) return null;
  return trimmed.split(/\s+/).map(parseSpfTerm);
}
