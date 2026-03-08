# LouvorJA Multiplatform — Central Delivery Tracker

Last repository analysis: **2026-03-08**

This is the single status tracker for implementation progress.

## Tracking Rules

1. Phase status is authoritative only in this file.
2. `docs/phase-*/HANDOFF.md` files keep implementation details and closure evidence, but must not diverge from this file.
3. Every status update requires repository evidence (code + verification command output).
4. Historical numbered phases remain tracked here, but newer post-phase delivery streams and active worktree efforts must also be recorded here.

## Verification Snapshot (2026-03-08)

- `pnpm exec tsc --noEmit` -> pass
- `pnpm lint:i18n` -> pass
- `cargo check --manifest-path src-tauri/Cargo.toml` -> pass
- `pnpm exec vite build` -> pass (bundle warning: `dist/assets/index-VAIlap3v.js` at 518.41 kB after minification)

## Phase Status Overview

| Phase | Spec | Name | Status | Evidence |
|:-----:|:----:|------|:------:|----------|
| 0 | 01 | Foundation | COMPLETE | historical baseline + commit history |
| 1 | 02 | Music & Lyrics Core | COMPLETE | historical baseline + commit history |
| 2 | 03 | Audio Playback & Synchronization | COMPLETE | historical baseline + commit history |
| 3 | 04 | Presentation Editor & .slja Archive | COMPLETE | historical baseline + commit history |
| 4 | 05 | Bible Module | COMPLETE | historical baseline + commit history |
| 5 | 06 | Worship Service / Liturgy Manager | COMPLETE | historical baseline + commit history |
| 6 | 07 | Multi-Monitor Display System | COMPLETE | historical baseline + commit history |
| 7 | 08 | HTTP Streaming Server | COMPLETE | historical baseline + commit history |
| 8 | 09 | Video & Multimedia | COMPLETE | historical baseline + phase docs |
| 9 | 10 | Utilities & Polish | COMPLETE | historical baseline + phase docs |
| 10 | 11 | Migration Tools & Deployment | COMPLETE | `docs/phase-10-migration-tools-deployment/HANDOFF.md` |
| 11 | 12 | Hymn CRUD + Collections + Hybrid Cache Covers | COMPLETE | `docs/phase-11-hymn-crud-collections/HANDOFF.md` |
| 12 | - | Monitor Assignment in Settings | COMPLETE | `docs/phase-12-monitor-screen-assignment/HANDOFF.md` |
| 13 | - | Architectural Improvement — Modernization | COMPLETE | `docs/plans/architectural-improvements-tasks.md` |

**Baseline progress:** 14 complete / 14 tracked historical phases

## Post-Phase Delivery Streams

The repository has continued to move after the last numbered phase. These streams are real implementation work and need to be tracked here instead of being left implicit in git history or plans.

| Stream | Status | Evidence |
|--------|--------|----------|
| Playing Queue and Playing now playback controls | COMPLETE | Commits `4439e87` and `e8a836a`; `src/components/playing-now/playing-queue.tsx`; `src/hooks/use-playback-coordinator.ts`; `src/routes/playing-now/index.tsx`; `tests/components/playing-queue.test.tsx`; `tests/stores/queue-store.test.ts` |
| Monthly Department Schedules with print workflow | COMPLETE | Commits `af7cfcf`, `a931981`, `5904bd6`, `e7c4c0c`, `2fdd1cf`, and `d0d6e88`; `src/routes/utilities/schedules.tsx`; `src-tauri/src/commands/schedules.rs`; `src-tauri/src/db/queries/schedules.rs`; `tests/schedules/calendar-helpers.test.ts`; `tests/schedules/department-labels.test.ts`; `tests/schedules/print-layout.test.ts` |
| Spotlight and shortcut UX refinement | COMPLETE | Commits `be7ca00`, `f2c057e`, and `88c3b73`; `src/routes/spotlight.tsx`; `src-tauri/src/commands/spotlight.rs`; `src/hooks/use-keyboard.ts`; `src/lib/shortcut-definitions.ts`; `tests/spotlight-shortcuts.test.ts` |
| Presentation bridge / external presentation control | IN PROGRESS | T-001 through T-009 implementation is present in the current worktree: `docs/plans/2026-03-07-external-presentation-control.md`; `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`; `docs/pre-dev/presentation-bridge/`; `scripts/prepare-sidecar.mjs`; `src-tauri/src/bin/presentation-bridge.rs`; `src-tauri/src/presentation_bridge/`; `src-tauri/src/commands/presentation_bridge.rs`; `src/routes/settings/index.tsx`; `src/components/settings/shortcuts-tab.tsx`; verified with `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo check --manifest-path src-tauri/Cargo.toml --bin presentation-bridge`, `pnpm build`, and `pnpm lint:i18n`; pending Windows manual acceptance from `docs/pre-dev/presentation-bridge/subtasks/T-009/ST-009-1-powerpoint-adapter-and-e2e.md` |
| Lyrics sync playback stabilization | IN PROGRESS | Current working tree and plans: `docs/plans/2026-03-07-lyrics-sync-playback-fix.md`; `docs/plans/2026-03-07-lyrics-sync-playback-fix-tasks.md`; `src-tauri/src/audio/player.rs`; `src-tauri/src/commands/audio.rs`; `src/components/music/audio-sync-editor.tsx`; `src/components/music/lyrics-display.tsx`; `src/hooks/use-hymn-playback.ts`; `src/stores/audio-store.ts`; `tests/stores/audio-store.test.ts`; `tests/lib/audio-sync.test.ts` |

## Current Evidence (Audited in This Update)

- Git history after `2026-03-04` shows committed product work on the Playing now queue, monthly schedules, print preview, spotlight behavior, and release/CI hardening.
- The current worktree contains active implementation for `presentation-bridge` and lyrics/audio synchronization follow-up work that has not yet been closed by a dedicated handoff.
- `presentation-bridge` is implemented through the planned T-009 code slice, including the sidecar, lifecycle modes, bridge-owned shortcuts, settings UI, PowerPoint adapter, and current Windows loopback IPC branch; the remaining closure item is manual acceptance on a Windows host.
- The current verification snapshot still passes despite those active changes, so the repository is not in a broken baseline state as of `2026-03-08`.

## Historical Closure Notes

1. Phase 11 handoff finalized at `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-11-hymn-crud-collections/HANDOFF.md`.
2. Phase 12 handoff finalized at `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-12-monitor-screen-assignment/HANDOFF.md`.
3. Phase 13 finalized at `docs/plans/architectural-improvements-tasks.md`.
