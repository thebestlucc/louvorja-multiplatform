# Presentation Bridge Context

**Feature:** `presentation-bridge`
**Workspace root:** `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform`

## Goal

Ship a standalone `presentation-bridge` runtime that can:

- register global next/previous shortcuts,
- control PowerPoint without LouvorJA being focused,
- run either as an app-managed process or an OS-started independent process,
- expose local IPC so LouvorJA can attach to an existing bridge instead of always spawning one.

## Contract Documents

- Design: `docs/plans/2026-03-07-presentation-bridge-lifecycle-design.md`
- Implementation plan: `docs/plans/2026-03-07-external-presentation-control.md`

If those two documents disagree, the design doc wins for lifecycle/IPC semantics.

## Existing Repo Files That Matter

- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/commands/settings.rs`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/routes/settings/index.tsx`
- `src/hooks/use-keyboard.ts`
- `src/lib/shortcut-definitions.ts`

## Locked Design Decisions

- `presentation-bridge` owns external next/previous shortcuts.
- LouvorJA must probe bridge IPC before spawning a new bridge.
- Bridge detection is based on IPC reachability, not process scanning.
- Lifecycle has exactly two modes:
  - `managed`
  - `independent`
- `managed` bridges die with LouvorJA.
- `independent` bridges survive LouvorJA exit.
- Bridge OS autostart is distinct from LouvorJA app autostart.
- Lifecycle mode changes require bridge restart.

## Expected Settings

- `presentation.bridge.enabled`
- `presentation.bridge.startWithOs`
- `presentation.bridge.targetApp`
- `presentation.bridge.shortcutNext`
- `presentation.bridge.shortcutPrev`

## Baseline Verification Commands

```bash
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && cargo check --manifest-path src-tauri/Cargo.toml
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm build
cd /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform && pnpm test:unit
```

## Non-Goals

- arbitrary unfocused-window key injection
- remote/network bridge control
- Linux Wayland delivery in MVP
- Keynote/Impress delivery in MVP
