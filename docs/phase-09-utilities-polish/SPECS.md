# Phase 09 Specs — Utilities & Polish

## 1. Implementation Objective

Implement the remaining utilities feature set and operator polish so LouvorJA can handle timer/clock/lottery/text workflows natively, with projection support and keyboard-first operation.

## 2. Baseline Gaps (Current Code)

1. Utilities screen is a placeholder:
   - `src/routes/utilities.tsx`
2. Timer backend commands are stubs:
   - `src-tauri/src/commands/timer.rs`
3. Utility backend commands are partially stubs:
   - `src-tauri/src/commands/utility.rs` (`run_lottery`, `format_text`)
4. Typed frontend wrappers/hooks for timer/lottery/format utilities are missing:
   - `src/lib/tauri.ts`
   - `src/lib/queries.ts`
5. Command palette exists but does not expose full utilities action coverage:
   - `src/components/ui/command-palette.tsx`

## 3. Public API / Type Contract Changes

### 3.1 Rust command contract

Update timer commands in `src-tauri/src/commands/timer.rs`:
- `start_timer(mode: String, duration_ms: Option<u64>) -> Result<(), AppError>`
- `pause_timer() -> Result<(), AppError>`
- `resume_timer() -> Result<(), AppError>`
- `reset_timer() -> Result<(), AppError>`
- `get_timer_state() -> Result<TimerStateData, AppError>`
- `add_lap() -> Result<u64, AppError>`

Update utility commands in `src-tauri/src/commands/utility.rs`:
- `run_lottery(names: Vec<String>) -> Result<String, AppError>`
- `format_text(text: String, format: String) -> Result<String, AppError>`

### 3.2 Rust state/type additions

Add timer state model in `src-tauri/src/state.rs`:
- `TimerMode` (`countdown` | `stopwatch`)
- `TimerStateData` (`mode`, `is_running`, `current_time_ms`, `duration_ms`, `laps`)
- Internal timing fields using `Instant` + accumulated elapsed ms.

### 3.3 Frontend type additions

Create `src/types/utilities.ts`:
- `TimerMode`
- `TimerStateData`
- `TextFormat` (`uppercase` | `lowercase` | `title_case` | `sentence_case`)
- `LotteryResult` shape if animation/projection metadata is needed.

## 4. Technical Scope

### 4.1 Routing and utilities information architecture

Replace placeholder route with directory routes:
- Create `src/routes/utilities/route.tsx`
- Create `src/routes/utilities/index.tsx`
- Create `src/routes/utilities/timer.tsx`
- Create `src/routes/utilities/clock.tsx`
- Create `src/routes/utilities/lottery.tsx`
- Create `src/routes/utilities/text.tsx`
- Remove legacy `src/routes/utilities.tsx`
- Regenerate `src/routeTree.gen.ts` via build.

### 4.2 Backend timer implementation

Update:
- `src-tauri/src/commands/timer.rs`
- `src-tauri/src/state.rs`
- `src-tauri/src/lib.rs`

Requirements:
1. Timer engine must be monotonic (`Instant`) and pause/resume safe.
2. Countdown mode requires positive `duration_ms`; stopwatch mode ignores duration.
3. `get_timer_state` returns computed live value when running.
4. `add_lap` only allowed in stopwatch mode while running.
5. No background busy loop; frontend polling drives UI refresh.

### 4.3 Utility command implementation

Update:
- `src-tauri/src/commands/utility.rs`
- `src-tauri/Cargo.toml` (if `rand` is not present)

Requirements:
1. `run_lottery` validates non-empty list and ignores blank lines.
2. `run_lottery` uses secure, unbiased random selection from sanitized inputs.
3. `format_text` supports exactly: uppercase, lowercase, title_case, sentence_case.
4. Invalid format returns explicit `AppError::Internal` with actionable message.

### 4.4 Frontend wrappers and query hooks

Update:
- `src/lib/tauri.ts`
- `src/lib/queries.ts`

Add wrappers:
- `startTimer`, `pauseTimer`, `resumeTimer`, `resetTimer`, `getTimerState`, `addLap`
- `runLottery`, `formatText`

Add hooks:
- `useTimerState` (poll at 250ms while running, slower when idle)
- `useStartTimer`, `usePauseTimer`, `useResumeTimer`, `useResetTimer`, `useAddLap`
- `useRunLottery`, `useFormatText`

### 4.5 UI components

Create:
- `src/components/utilities/timer-display.tsx`
- `src/components/utilities/clock-display.tsx`
- `src/components/utilities/lottery-animation.tsx`
- `src/components/utilities/keyboard-shortcuts-panel.tsx`

Requirements:
1. Timer display supports large projection-safe typography and threshold colors.
2. Clock display supports 12h/24h and optional date.
3. Lottery animation supports start/stop lifecycle and deterministic winner reveal.
4. Shortcuts panel is searchable and opened by `Cmd+/` / `Ctrl+/`.

### 4.6 Projection integration contract

Update:
- `src/components/slides/projector-view.tsx`
- `src/routes/return.tsx`
- `src/hooks/use-keyboard.ts`

Requirements:
1. Utility projection must not destroy selected slide context.
2. Utility projection activation/clear behavior must be explicit and reversible.
3. Timer/clock projected updates are throttled to 1Hz max for projector/return rendering.
4. Existing hymn/Bible/presentation/video projection behavior remains unchanged.

### 4.7 Command palette and polish

Update:
- `src/components/ui/command-palette.tsx`
- `src/components/layout/status-bar.tsx`
- `src/routes/settings/index.tsx`
- `global.css`
- `src/stores/theme-store.ts`

Requirements:
1. Add utility commands and global actions to command palette.
2. Add compact timer indicator/status integration in status bar.
3. Finalize theme options with readable contrast and smooth transitions.
4. Keep theme persistence and locale behavior stable.

### 4.8 Localization

Update:
- `src/locales/en.json`
- `src/locales/pt.json`
- `src/locales/es.json`

All new utility UI strings and errors must exist in all three locales.

## 5. Delivery Sequence

1. Implement backend timer state/commands and utility commands.
2. Add frontend wrappers/types/query hooks.
3. Replace utilities placeholder route with utility pages.
4. Integrate projection behavior for timer/clock/lottery.
5. Expand command palette + shortcuts panel + status polish.
6. Apply i18n and theme polish updates.
7. Run full verification and manual smoke.

## 6. Acceptance Criteria

1. `/utilities` contains functional timer, clock, lottery, and text tools.
2. Timer supports countdown/stopwatch, pause/resume/reset, and lap capture.
3. Lottery selects a valid winner from provided names and handles empty input safely.
4. Text formatter returns correct output for all supported formats.
5. Utility outputs project and clear cleanly without breaking slide projection.
6. Command palette and keyboard shortcut help expose utility workflows.
7. All checks/build pass; no `Not implemented` utility/timer command remains.

## 7. Verification Plan

### Static checks
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`

### Runtime smoke
1. Start countdown timer, project it, pause/resume/reset, validate displayed values.
2. Start stopwatch, capture laps, verify lap ordering and timing.
3. Project clock in 12h and 24h modes, verify second-by-second updates.
4. Run lottery with populated names, verify winner is from input and remove/repick flow works.
5. Use text formatter with all supported modes and verify exact output.
6. Trigger utility actions through command palette and keyboard shortcuts.
7. Confirm hymn/Bible/presentation/video projection still works after utility projection.

## 8. Deferrals

- User-customizable shortcut rebinding UI.
- Advanced lottery weighting and persistence across sessions.
- Multi-screen independent utility overlays with per-monitor content divergence.
