import { RECORD_TYPE_CONVENTION, RECORD_TYPE_GROUPS } from "./recordTypes";

export interface RecordTypeGroupsProps {
  selectedTypes: Set<string>;
  toggleType: (type: string) => void;
  isRecordTypeCheckboxDisabled: (type: string) => boolean;
  recordTypeTitle: (type: string) => string | undefined;
  onOpenHelp: (type: string) => void;
}

export function RecordTypeGroups({
  selectedTypes,
  toggleType,
  isRecordTypeCheckboxDisabled,
  recordTypeTitle,
  onOpenHelp,
}: RecordTypeGroupsProps) {
  return (
    <div class="record-type-groups">
      {RECORD_TYPE_GROUPS.map((group) => (
        <div key={group.label} class="record-type-group">
          <p class="record-type-group__label">{group.label}</p>
          <div class="record-type-group__options">
            {group.types.map((type) => {
              const disabled = isRecordTypeCheckboxDisabled(type);
              const isConvention = Boolean(RECORD_TYPE_CONVENTION[type]);
              const title = recordTypeTitle(type);
              return (
                <div
                  key={type}
                  class={`record-type-option${isConvention ? " record-type-option--convention" : ""}${
                    disabled ? " record-type-option--disabled" : ""
                  }`}
                  title={title}
                >
                  <label class="record-type-option__toggle" for={`record-type-${type}`}>
                    <input
                      id={`record-type-${type}`}
                      type="checkbox"
                      class="record-type-option__checkbox"
                      checked={selectedTypes.has(type)}
                      disabled={disabled}
                      onChange={() => toggleType(type)}
                    />
                    <span class="record-type-option__label">{type}</span>
                  </label>
                  <button
                    type="button"
                    class="record-type-help-trigger"
                    onClick={() => onOpenHelp(type)}
                    aria-label={`What is a ${type} record?`}
                  >
                    ?
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
