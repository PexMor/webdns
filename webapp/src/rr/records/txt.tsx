import { useState } from "preact/hooks";
import { FollowUpValue, LabeledField } from "../LabeledField";
import { registerRrTypes } from "../registry";
import { resolveExplain } from "../types";
import type { FollowUpQuery, ParsedFieldValues, RrFieldMeta, RrParser, RrView } from "../types";
import { tokenize } from "../tokenize";
import { parseSpfTerms, type SpfTerm } from "./spf";
import { getSpfMechanismHelp, spfHelpTriggerParts, type SpfMechanismHelp } from "./spfHelp";
import { SpfMechanismHelpModal } from "./SpfMechanismHelpModal";

type TxtFields = ParsedFieldValues & {
  strings: string[];
};

const parseTxt: RrParser<TxtFields> = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('"')) {
    return { strings: [trimmed] };
  }
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;
  return { strings: tokens };
};

const TXT_FIELD: RrFieldMeta = {
  key: "strings",
  label: "Text",
  explain: {
    minimal: "Text value",
    standard: "Free-form text published for this domain.",
    detailed:
      "One or more character-strings (RFC 1035) up to 255 bytes each. Commonly used for SPF, DKIM, DMARC, domain-ownership verification, and other policy or configuration data. Multiple strings on one record are typically concatenated by the consuming application.",
  },
};

const TXT_FIELDS: RrFieldMeta[] = [TXT_FIELD];

function SpfHelpTrigger({
  label,
  help,
  onShowHelp,
}: {
  label: string;
  help: SpfMechanismHelp;
  onShowHelp: (help: SpfMechanismHelp) => void;
}) {
  return (
    <button
      type="button"
      class="spf-help-trigger"
      onClick={() => onShowHelp(help)}
      aria-label={`Explain ${label}`}
    >
      {label}
    </button>
  );
}

function SpfHelpLabel({
  term,
  help,
  onShowHelp,
}: {
  term: SpfTerm;
  help: SpfMechanismHelp;
  onShowHelp: (help: SpfMechanismHelp) => void;
}) {
  const { label, separator } = spfHelpTriggerParts(term);
  return (
    <>
      <SpfHelpTrigger label={label} help={help} onShowHelp={onShowHelp} />
      {separator}
    </>
  );
}

function SpfTermValue({
  term,
  onFollowUp,
  onShowHelp,
}: {
  term: SpfTerm;
  onFollowUp?: (query: FollowUpQuery) => void;
  onShowHelp: (help: SpfMechanismHelp) => void;
}) {
  const help = getSpfMechanismHelp(term);

  if (term.kind && term.value !== null) {
    return (
      <span class="spf-term">
        {help ? <SpfHelpLabel term={term} help={help} onShowHelp={onShowHelp} /> : term.prefix}
        <FollowUpValue value={term.value} kind={term.kind} onFollowUp={onFollowUp} />
        {term.suffix}
      </span>
    );
  }

  if (help) {
    return <SpfHelpLabel term={term} help={help} onShowHelp={onShowHelp} />;
  }

  return <>{term.raw}</>;
}

const TxtView: RrView<TxtFields> = ({ detailLevel, value, onFollowUp }) => {
  const joined = value.strings.join("");
  const spfTerms = parseSpfTerms(joined);
  const [spfHelp, setSpfHelp] = useState<SpfMechanismHelp | null>(null);

  if (!spfTerms) {
    return (
      <div class="rr-field-list">
        <LabeledField
          label={TXT_FIELD.label}
          value={value.strings}
          explain={TXT_FIELD.explain}
          detailLevel={detailLevel}
        />
      </div>
    );
  }

  const explanation = resolveExplain(TXT_FIELD.explain, detailLevel);
  return (
    <div class="rr-field-list">
      <div class="rr-field">
        <div class="rr-field__row">
          <span class="rr-field__label">{TXT_FIELD.label}</span>
          <span class="rr-field__value">
            <ul class="spf-terms rr-field__value-item rr-field__value-item--spf">
              {spfTerms.map((term, i) => (
                <li class="spf-term-line" key={i}>
                  <SpfTermValue term={term} onFollowUp={onFollowUp} onShowHelp={setSpfHelp} />
                </li>
              ))}
            </ul>
          </span>
        </div>
        {explanation && <p class="rr-field__explain">{explanation}</p>}
      </div>
      <SpfMechanismHelpModal help={spfHelp} onClose={() => setSpfHelp(null)} />
    </div>
  );
};

registerRrTypes({
  TXT: { parse: parseTxt, fields: TXT_FIELDS, View: TxtView },
});
