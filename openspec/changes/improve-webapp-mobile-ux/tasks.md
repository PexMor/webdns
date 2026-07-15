## 1. Backend: configurable static asset cache header

- [x] 1.1 Add `tower` dependency (for `ServiceBuilder`/`Layer`) and enable the `set-header` feature on `tower-http` in `dns-backend/Cargo.toml`
- [x] 1.2 Add `static_cache_seconds: u64` to `Cli`, `FileConfig`, and `AppConfig` in `dns-backend/src/config.rs`, with `env_static_cache_seconds()` reading `DNS_STATIC_CACHE_SECONDS`, a `default_static_cache_seconds() -> u64` returning `600`, and resolution via the existing `resolve_*` helper pattern (CLI > env > TOML > default), logged like other settings
- [x] 1.3 In `dns-backend/src/main.rs`, wrap `ServeDir::new(web_root)` with `SetResponseHeaderLayer::overriding(CACHE_CONTROL, HeaderValue::from_str(&format!("max-age={static_cache_seconds}")).unwrap())` via `tower::ServiceBuilder`, and pass the wrapped service to `.fallback_service(...)` so `/version` and `/ws` are unaffected
- [x] 1.4 Add/extend backend tests covering: default `max-age=600` when unset, an overridden value via CLI/env/TOML, and that `/version` still returns `no-store` (not the static max-age header)

## 2. Webapp: unify record-type fold preference

- [x] 2.1 In `webapp/src/queryFormPrefsStore.ts`, add `expandRecordTypesByDefault` (default `false`) with `getExpandRecordTypesByDefault`/`setExpandRecordTypesByDefault`/`initExpandRecordTypesByDefault`, migrating a one-time read of the legacy `autoFoldRecordTypes` key (invert its value into the new key, then leave the old key untouched) when the new key is absent
- [x] 2.2 Remove `autoFoldRecordTypes`/`setAutoFoldRecordTypes` usage from `webapp/src/app.tsx` and `webapp/src/menu.tsx`, replacing with `expandRecordTypesByDefault`
- [x] 2.3 In `webapp/src/app.tsx`, initialize `recordTypesFolded` state from `!expandRecordTypesByDefault` on load, and re-fold after a successful submit only when `expandRecordTypesByDefault` is `false`

## 3. Webapp: full-screen record-type picker

- [x] 3.1 Create `webapp/src/RecordTypePicker.tsx` modeled on the existing `.menu-overlay`/`.menu-panel` structure (Escape-to-close, backdrop-click-to-close), accepting the same props `app.tsx` already derives for the inline fieldset today (`selectedTypes`, `toggleType`, `isRecordTypeCheckboxDisabled`, `recordTypeTitle`, `onOpenHelp`, `onClose`)
- [x] 3.2 In `webapp/src/app.tsx`, replace the inline expanded `record-type-groups` branch with: a collapsed summary view (existing `record-type-folded` markup) whose "Change" button opens `RecordTypePicker` as an overlay, instead of expanding inline
- [x] 3.3 Wire `RecordTypePicker`'s close/submit interactions so submitting a lookup from within the picker closes it and returns to the collapsed summary (when `expandRecordTypesByDefault` is off)

## 4. Webapp: touch-friendly record type controls

- [x] 4.1 In `webapp/src/style.css`, restyle `.record-type-option` and its checkbox: `appearance: none` on the input, a chip-style label with checked/unchecked background states, and a minimum 44x44 CSS pixel tap target per control
- [x] 4.2 Adjust the record-type help trigger so it remains a distinguishable, separately tappable affordance within or beside the chip rather than overlapping the toggle tap zone
- [x] 4.3 Verify convention-disabled styling (`.record-type-option--disabled`) and convention-highlight styling (`.record-type-option--convention`) still read correctly against the new chip treatment

## 5. Webapp: split Settings into primary + Advanced

- [x] 5.1 Add `"advanced-settings"` to the `MenuPanel` type in `webapp/src/menu.tsx`
- [x] 5.2 Trim `SettingsPanel` down to: Server URL, WebSocket URL, DNS server select, the `expandRecordTypesByDefault` toggle (relabeled "Keep record types expanded"), and a button/row opening Advanced settings
- [x] 5.3 Create an `AdvancedSettingsPanel` component (in `menu.tsx` or a new file) containing: color theme, help example layout, record display mode, explanation detail level, custom DNS server management block, API key, and connection headers management — moved as-is from the current `SettingsPanel`
- [x] 5.4 Render `AdvancedSettingsPanel` for `panel === "advanced-settings"` in `Menu`, with its back control returning to `"settings"` rather than the root menu (while `SettingsPanel`'s back control still returns to root)
- [x] 5.5 Update `app.tsx`'s props passed into `Menu` if any handlers need to move/duplicate between `SettingsPanel` and `AdvancedSettingsPanel`

## 6. Verification

- [x] 6.1 Run the webapp test suite (`vitest`) and add/update tests for the fold-preference migration and initial folded state
- [x] 6.2 Run the backend test suite (`cargo test`) including the new cache-header tests
- [x] 6.3 Manually exercise on a narrow/mobile viewport: default folded state, opening the picker, selecting types with the new chip controls, submitting, re-folding, and reaching Advanced settings from Settings
