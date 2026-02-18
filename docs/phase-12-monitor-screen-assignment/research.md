# Phase 12 Research — Monitor Screen Assignment in Settings

---
feature: monitor-screen-assignment
gate: 0
date: 2026-02-18
research_mode: modification
method: local-codebase-analysis
---

## Executive Summary

The application already persists monitor-role assignments and uses them for automatic projection startup, but assignments are currently configured only in onboarding. A settings-level monitor assignment section can be added with low architectural risk by reusing existing monitor APIs and harmonizing manual monitor toggles with saved assignments.

## Codebase Findings

1. Existing settings page has a projector section but no monitor-role assignment UI.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx:411`
2. Onboarding already supports selecting projector/return monitor roles and persisting them.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx:23`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx:47`
3. Monitor config persistence APIs and hooks already exist.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts:831`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts:838`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts:201`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts:205`
4. Automatic projection startup already resolves monitor indexes from saved config with fallbacks.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/projection-playback.ts:39`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/projection-playback.ts:117`
5. Manual projector/return toggles still use hardcoded fallback indexes and do not read saved monitor configs.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-monitors.ts:71`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-monitors.ts:93`
6. Backend persistence layer for `monitor_configs` is implemented and stable for this scope.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/migrations.rs:166`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/queries/settings.rs:50`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs:547`

## Product/UX Findings

1. Deferred item already documented: monitor config UI in post-Phase-6 handoff.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/handoffs/phase7-streaming/2026-02-11_23-42-22_phase6-complete-phase7-next.md:45`
2. Settings copy currently covers default projector content and logo, but not monitor assignment controls.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json:502`
3. Onboarding already has localized strings that can be reused/extended for monitor assignment labels and actions.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json:554`

## Constraints and Risks

1. Monitor IDs (`monitor-{index}`) are index-derived and may shift when hardware changes.
2. Runtime inconsistency risk if settings assignment is implemented but manual controls keep hardcoded selection behavior.
3. UX confusion risk if both projection roles point to the same monitor without explicit warning/fallback.

## Recommendation

Proceed as **Small Track** planning: this is an extension of existing behavior, uses existing APIs, and does not require new dependencies or schema changes. Include a technical task to unify monitor resolution logic between auto-start and manual toggles.
