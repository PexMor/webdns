## Why

On mobile, the record type selector renders each type as a rounded pill combining a checkbox toggle and a "?" help button. The checkbox's actual tap-responsive area only covers the pill's top-left region — tapping the record type text itself (e.g. "AAAA", "A") or the rest of the pill does nothing, so users must hunt for a small hit target. The pill also visually fuses the toggle and the help affordance into what reads as one control, when they're actually two unrelated actions (select vs. learn more), adding confusion without adding value.

## What Changes

- Fix the record type toggle so the entire type pill/label is a reliable tap target on mobile, not just a corner of it.
- Visually and structurally separate the "select this type" toggle from the "what is this record type?" help affordance, so they read and behave as two distinct controls rather than one ambiguous pill.
- Preserve existing desktop mouse/keyboard behavior, the convention-engaged disabled state (dimmed, non-interactive types), and the `?` help modal's existing content and behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dns-web-client`: the record type selection control's interaction requirement is tightened to require that the entire visible type toggle (not just a small sub-region) responds to tap/click, and that the per-type help affordance is a separately identifiable control from the selection toggle.

## Impact

- `webapp/src/RecordTypeGroups.tsx`: markup for each record type option (checkbox/label/help button structure).
- `webapp/src/style.css`: `.record-type-option`, `.record-type-option__toggle`, `.record-type-option__label`, `.record-type-help-trigger` rules.
- `webapp/src/RecordTypePicker.tsx` (mobile modal) and any desktop inline usage of `RecordTypeGroups` — both consume the same component, so the fix applies everywhere the selector is rendered.
- No backend, WebSocket protocol, or data model changes.
