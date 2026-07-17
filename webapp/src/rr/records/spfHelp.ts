import type { SpfTerm } from "./spf";

export interface SpfMechanismHelp {
  title: string;
  description: string;
}

const SPF_MECHANISM_HELP: Record<string, string> = {
  "v=spf1":
    "Identifies this TXT record as an SPF policy (RFC 7208, version 1). Every SPF record must start with this version tag.",
  a: "Pass if the sender's IP matches an A or AAAA record for this domain, or for the host named after a:.",
  mx: "Pass if the sender's IP matches an address of an MX host for this domain, or for the domain named after mx:.",
  ip4: "Pass if the sender's IPv4 address is in the listed network. An optional /nn CIDR suffix narrows the range.",
  ip6: "Pass if the sender's IPv6 address is in the listed network. An optional /nn CIDR suffix narrows the range.",
  include:
    "Look up the SPF policy (TXT record) at the named domain and pass if that policy passes for this sender.",
  exists:
    "Pass if a DNS A-record lookup for the constructed domain name returns any result. Often used with macros.",
  redirect:
    "Stop evaluating this record and use the SPF policy published at the named domain instead.",
  all: "Always matches. The leading qualifier sets the default when no earlier mechanism matched: + pass, - fail (reject mail), ~ softfail (accept but mark suspicious), ? neutral (no policy statement).",
  ptr: "Deprecated and slow. Pass if a PTR lookup of the sender IP yields a hostname that forward-resolves. Not recommended.",
};

/** Mechanism key used to look up help text for an SPF term. */
export function spfMechanismKey(term: SpfTerm): string | null {
  const raw = term.raw.toLowerCase();
  if (raw === "v=spf1") return "v=spf1";

  if (term.prefix.includes("redirect=")) return "redirect";

  const colonMatch = /^[+\-~?]?([a-z0-9-]+):/.exec(term.raw);
  if (colonMatch) return colonMatch[1].toLowerCase();

  const body = raw.replace(/^[+\-~?]/, "");
  if (body in SPF_MECHANISM_HELP) return body;

  return null;
}

export function getSpfMechanismHelp(term: SpfTerm): SpfMechanismHelp | null {
  const key = spfMechanismKey(term);
  if (!key) return null;
  const description = SPF_MECHANISM_HELP[key];
  if (!description) return null;

  const title =
    term.value === null
      ? term.raw
      : term.prefix.endsWith("=")
        ? term.prefix
        : `${key}:`;

  return { title, description };
}

/** Clickable label and trailing separator shown outside the help trigger. */
export function spfHelpTriggerParts(term: SpfTerm): { label: string; separator: string } {
  if (term.value === null) {
    return { label: term.raw, separator: "" };
  }
  if (term.prefix.endsWith(":")) {
    return { label: term.prefix.slice(0, -1), separator: ":" };
  }
  if (term.prefix.endsWith("=")) {
    return { label: term.prefix.slice(0, -1), separator: "=" };
  }
  return { label: term.prefix, separator: "" };
}
