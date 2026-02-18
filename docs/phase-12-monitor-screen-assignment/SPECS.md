# Phase 12 Specs — Monitor Assignment in Settings

## 1. Objective

Implement a Settings-based monitor assignment workflow for projector and return roles, reusing existing persistence and making runtime monitor selection behavior consistent across auto-start and manual controls.

## 2. Current-State Gaps

1. Settings has projector-content configuration but no monitor assignment controls.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx:411`
2. Onboarding has assignment UI, creating a feature gap after first-run setup.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx:23`
3. Auto-start projection resolves monitor config; manual toggles still rely on static monitor indexes.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/projection-playback.ts:117`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-monitors.ts:71`

## 3. Architecture Decisions

1. Keep existing `monitor_configs` storage contract unchanged.
2. Introduce/centralize one monitor-resolution function used by:
   - projection startup (`ensureProjectionScreensStarted`)
   - manual projector/return toggles (`useMonitorsControl`)
3. Implement settings monitor-assignment UI as an extension inside the existing Projector Screens section.
4. Keep role scope to `projector` and `return` in UI for this phase.

## 4. File Impact Plan

### Frontend

1. Update settings route UI and logic:
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
2. Reuse or extract monitor assignment controls from onboarding flow:
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/display/*` (new shared component if extracted)
3. Harmonize manual toggle behavior with saved configs:
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-monitors.ts`
4. Consolidate monitor index resolver logic:
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/projection-playback.ts`
   - Optional shared helper: `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-resolution.ts`
5. Ensure query hooks remain source of truth for monitor configs:
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts`

### i18n

1. Add settings-specific monitor assignment copy and feedback messages:
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`

### Backend

No schema change required. Existing commands and queries are sufficient:
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs:547`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/queries/settings.rs:69`

## 5. Behavioral Requirements

1. If a saved monitor ID is unavailable, use deterministic fallback.
2. If `projector` and `return` resolve to same monitor and more than one monitor exists, auto-separate.
3. Test actions in Settings open each role window on the resolved target monitor.
4. Save actions persist immediately and re-query monitor configs.
5. Keyboard shortcuts and status-bar controls must respect saved assignments.

## 6. UX Requirements

1. Monitor rows show name, resolution, and primary indicator.
2. Save/test actions are disabled when no monitors are detected.
3. Error feedback is visible inline or via toast.
4. Controls meet keyboard accessibility and labeling expectations.

## 7. Acceptance Criteria

1. `/settings` includes monitor assignment controls for projector and return screens.
2. Saved assignments are loaded when opening Settings.
3. Updating assignments modifies runtime behavior of manual monitor toggles.
4. Onboarding monitor setup remains functional.
5. EN/PT/ES translations include new settings strings.
6. Static checks pass.

## 8. Verification Commands

1. `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform vite build`
2. `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
3. `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
