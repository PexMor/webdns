## Context

`RecordTypeGroups.tsx` renders each record type as a `.record-type-option` pill: a `999px` border-radius container holding `.record-type-option__toggle` (a `position: relative` wrapper with a `position: absolute; inset: 0` `<input type="checkbox">` plus a `pointer-events: none` `<label>` drawn on top of it) and a separate `.record-type-help-trigger` `?` button.

The intent was for the invisible, absolutely-positioned checkbox to cover the whole `__toggle` box so any tap on the label passes through (`pointer-events: none`) to the checkbox beneath it. In practice, on mobile WebKit/Blink touch handling, `appearance: none` checkboxes positioned with `inset: 0` do not reliably hit-test across their full CSS box for touch — only a small region near the input's origin (top-left) responds. The result: users can only toggle a type by tapping a sliver in the corner of the pill, never the visible type name text or the rest of the pill body, which reads as broken.

Because the checkbox and the `?` button live inside the same rounded pill with no visual seam beyond a thin border, the pill also reads as a single control, obscuring that the `?` is an unrelated, secondary action (open help) rather than part of toggling selection.

This is used both in the mobile modal (`RecordTypePicker.tsx`) and any inline desktop rendering of `RecordTypeGroups`, so a fix here applies everywhere.

## Goals / Non-Goals

**Goals:**
- Make the entire type toggle (pill body and label text) a reliable tap/click target across mobile and desktop.
- Make the help affordance visually and structurally distinct from the toggle, so it's clearly a secondary, separate action.
- Keep the existing disabled/dimmed state for types excluded by an engaged convention, and keep the `?` reachable (as `cursor: help`) even when the type itself is disabled.
- No change to `RecordTypeHelpModal` content/behavior, or to `toggleType`/`onOpenHelp` call signatures.

**Non-Goals:**
- Redesigning the overall record type picker layout/grouping (`RecordTypeGroups`'s grouping-by-category behavior is unchanged).
- Changing convention-engagement business logic (`dns-query-input-transforms`) — only the rendering/interaction of the toggle itself.

## Decisions

**Make the `<label>` the tap target instead of relying on an overlaid absolutely-positioned checkbox.**
Rather than fighting the mobile hit-testing quirk of an `inset: 0` checkbox with a `pointer-events: none` label on top, wrap the checkbox input normally inside the `<label for=...>` (or use the implicit label-wraps-input pattern) so the browser's native "click anywhere in the label toggles the associated control" behavior does the work. This is the standard, framework-agnostic way checkboxes are made fully tappable and avoids re-implementing hit-testing with CSS. The checkbox itself can stay visually hidden (`position: absolute; opacity: 0` or `sr-only`-style) since the pill's background/border already communicates checked state — but it no longer needs to be the thing intercepting the tap.

Alternative considered: keep the absolute-positioned checkbox but add explicit `min-width`/`min-height`/`touch-action` fixes. Rejected — the underlying WebKit behavior is about the input's rendered/hit-tested geometry for form controls specifically, not a sizing bug, so CSS-only tweaks are unreliable across engines. Wrapping in a real `<label>` sidesteps the issue entirely rather than working around it.

**Give the help trigger its own visually separated hit region, outside the toggle's pill shape.**
Round the toggle pill's right edge only where it doesn't meet the help button, and add a visible divider (already present as `border-left`) plus enough spacing/contrast that the `?` reads as its own tappable chip, not a continuation of the type pill. Keep `.record-type-help-trigger` a `type="button"` (already true) so it never interacts with the checkbox's native label-click behavior.

**Keep one Preact component (`RecordTypeGroups`), no new component split.**
The proposal is about interaction/markup within the existing component, not information architecture — no need for a new `RecordTypeToggle`/`RecordTypeHelpButton` split unless it meaningfully simplifies the JSX. A single component keeps the change small and testable with the existing test files.

## Risks / Trade-offs

- [Risk] Wrapping the checkbox in a real `<label>` changes which element receives focus/click events, which could affect existing tests in `RecordTypeGroups`/`RecordTypePicker` test files that query by role/label text → Mitigation: run the existing webapp test suite after the change and adjust selectors only if they break; behavior (checked state, `toggleType` calls) stays the same.
- [Risk] Visually separating the help button could increase the pill's total width, causing wrapping/overflow issues in the mobile modal at narrow viewports → Mitigation: verify at common mobile widths (360–414px) that groups still wrap cleanly (`.record-type-group__options` already uses `flex-wrap: wrap`).

