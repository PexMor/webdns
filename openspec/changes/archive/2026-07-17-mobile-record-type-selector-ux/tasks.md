## 1. Markup: make the label the tap target

- [x] 1.1 In `webapp/src/RecordTypeGroups.tsx`, restructure `.record-type-option__toggle` so the `<input type="checkbox">` is nested inside its `<label>` (or otherwise uses native label-wraps-input association) instead of being an absolutely-positioned overlay with a `pointer-events: none` label on top.
- [x] 1.2 Keep the checkbox visually hidden (e.g. clipped/opacity-0) while the pill's existing checked-state styling (`background`/`border-color` via `:checked`) continues to work through the sibling/label selector.
- [x] 1.3 Confirm `onChange={() => toggleType(type)}`, `disabled={disabled}`, and the `id`/`title` attributes are preserved so existing behavior (convention-disabled types, tooltips) is unaffected.

## 2. Markup: separate the help affordance

- [x] 2.1 Adjust `.record-type-option` / `.record-type-help-trigger` styling in `webapp/src/style.css` so the help button reads as a visually distinct chip (not a continuation of the toggle pill) — e.g. its own rounded edge, background, or spacing gap from the toggle.
- [x] 2.2 Verify the help button stays a `type="button"` with its own `onClick={() => onOpenHelp(type)}`, unaffected by the label/checkbox restructuring in Task 1.
- [x] 2.3 Verify the help affordance remains tappable and opens help content when the record type's checkbox is disabled (convention engaged for another type).

## 3. Verification

- [x] 3.1 Update/add tests in `webapp/src/RecordTypeGroups.test.tsx` (create if it doesn't exist) covering: clicking the type label toggles selection, clicking the help button does not toggle selection, and the help button works while the checkbox is disabled.
- [x] 3.2 Run the existing webapp test suite (`RecordTypePicker`, `RecordTypeHelpModal`, `RecordResultCard` tests) and fix any selector breakage caused by the markup change.
- [x] 3.3 Manually verify on a mobile viewport (browser dev tools device emulation or a real device) that tapping anywhere on a record type's pill/label — not just a corner — toggles it, for both the mobile modal (`RecordTypePicker`) and any desktop inline rendering.
- [x] 3.4 Confirm the pills still wrap cleanly in `.record-type-group__options` at narrow mobile widths (~360–414px) after the visual separation of the help chip.
