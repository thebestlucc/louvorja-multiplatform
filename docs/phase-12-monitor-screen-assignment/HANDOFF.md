# Phase 12 Handoff — Monitor Assignment in Settings

## Status

- Phase status: `IN PROGRESS`
- Last updated: `2026-02-18`
- Current focus: monitor-routing fix plus assignment UX safeguards implemented and validated via static/automated checks; awaiting live smoke confirmation.

## Implemented

1. Shared monitor-resolution helper centralized for projector/return role resolution.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-resolution.ts`
2. Projection startup flow aligned to shared resolver.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/projection-playback.ts`
3. Manual monitor toggles aligned to saved monitor configs (status bar + shortcuts path).
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-monitors.ts`
4. Settings monitor assignment UI delivered (projector/return selectors, save action, test actions, inline feedback).
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
5. Localization coverage added for EN/PT/ES.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`
6. Unit coverage added for monitor resolver behavior and wired into unit test command.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tests/monitor-resolution.test.ts`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tsconfig.unit-tests.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/package.json`
7. Monitor identity and window-target contract hardened (fix for wrong-monitor opening):
   - backend monitor IDs switched from transient index IDs to stable monitor fingerprints.
   - projector/return open commands switched to `monitorId` (instead of transient monitor index).
   - frontend projection flows switched to pass monitor IDs in startup, settings test actions, onboarding tests, and manual toggles.
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/projection-playback.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/hooks/use-monitors.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
8. Distinct monitor-role enforcement added (projector and return cannot share same monitor when multiple displays are connected).
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`
9. Monitor labels now prefer a descriptive brand-style name (`brand (resolution)`) with existing monitor name preserved as fallback.
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-display-name.ts`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
   - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
   - refined: synthetic monitor identifiers (`monitor-<id>`, connector labels like `DP-1`, generic monitor labels) are now filtered out and fallback to `Monitor N`; known vendor/model strings remain preferred.
   - test coverage added:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tests/monitor-resolution.test.ts`
10. Real-time monitor hotplug refresh added:
   - backend monitor watcher emits `monitors-changed` when monitor topology changes (plug/unplug/reconfigure).
   - frontend root listener invalidates monitor query cache so Settings/Onboarding monitor selects refresh automatically.
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/__root.tsx`
11. Hotplug default assignment now prioritizes external display for projector role:
   - projection fallback resolver now prefers first non-primary monitor as default projector.
   - settings/onboarding fallback assignment uses resolver defaults when no persisted config exists.
   - backend monitor listing now marks primary monitor using OS primary-monitor API (not index order), improving external detection reliability.
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-resolution.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tests/monitor-resolution.test.ts`
12. Monitor metadata enrichment path added to identify richer attributes beyond monitor ID:
   - backend now merges Tauri monitor list with `display-info` metadata (matched by geometry/position/scale) and exposes:
     - `friendly_name`
     - `manufacturer`
     - `model`
     - `connection_type` (`integrated`, `external`, `unknown`)
   - frontend monitor name rendering now prioritizes explicit manufacturer/model fields before fallback heuristics.
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/db/models.rs`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/settings.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-display-name.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tests/monitor-resolution.test.ts`
   - follow-up fix: metadata mapping is now one-to-one across monitors/displays (global scoring assignment), preventing duplicated friendly_name/model across all monitor options.
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/display.rs`
13. Settings UI now exposes inferred connection type per monitor (badge + selector text):
   - connection badges added: `Integrated` / `External` / `Unknown`
   - selector options now include connection type text
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`
14. Default projector role remains hard-defaulted to a non-primary monitor when available:
   - resolver fallback prioritizes non-primary displays
   - settings/onboarding fallback assignment consumes resolver output when no valid persisted config exists
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-resolution.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/settings/index.tsx`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/onboarding/monitors.tsx`
15. Automatic monitor-config reassignment now runs on monitor topology/primary changes:
   - when a new monitor is plugged in, projector assignment auto-switches to the newly connected monitor
   - when OS primary monitor changes, projector assignment auto-switches to the current non-primary default
   - return assignment is automatically kept distinct from projector
   - files:
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/monitor-resolution.ts`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/__root.tsx`
     - `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/tests/monitor-resolution.test.ts`

## Verification Evidence

- `pnpm test:unit`
- `pnpm exec vite build`
- `pnpm exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`

## Root Cause and Resolution

1. Root cause:
   - monitor IDs were index-derived (`monitor-0`, `monitor-1`, ...), so saved assignments could point to the wrong physical monitor after monitor reordering/reconnection.
   - open commands used monitor index on fresh monitor enumeration, amplifying ordering drift.
   - same-monitor role assignments (projector == return) created ambiguous behavior in testing/open flows for return window.
2. Resolution:
   - monitor IDs now use stable fingerprints (name + geometry + scale hash).
   - open commands now target monitors by `monitorId`.
   - runtime compatibility kept for legacy saved values (`monitor-<index>`) in resolver/open path fallback.
   - UI now blocks duplicate role assignment when multiple monitors are available and shows explicit corrective messaging.

## Remaining Validation

1. Execute live manual smoke on real multi-monitor hardware:
   - assign projector/return in Settings;
   - use both test buttons;
   - use F5 and Shift+F5 toggles;
   - reconnect/reorder monitors and re-verify.
2. If smoke passes, update phase status to `COMPLETE`.
