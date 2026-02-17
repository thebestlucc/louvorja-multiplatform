# Phase 09 Tasks — Utilities & Polish

## Summary
- Skill used: `ring:writing-plans`.
- Decision locked: the presentation slide sidebar clipping fix is the first blocking item in Phase 09 (`Batch 0`).
- This task file defines a decision-complete execution sequence for Phase 09.

## Public APIs / Interfaces / Types Changes
1. Rust timer command contract in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/timer.rs`:
- `start_timer(mode, duration_ms)`
- `pause_timer()`
- `resume_timer()`
- `reset_timer()`
- `get_timer_state()`
- `add_lap()`

2. Rust utility command contract in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/commands/utility.rs`:
- `run_lottery(names: Vec<String>) -> Result<String, AppError>`
- `format_text(text: String, format: String) -> Result<String, AppError>`

3. Rust state/type additions in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/state.rs`:
- `TimerMode`
- `TimerStateData`
- Internal timer runtime state with `Instant` and accumulated elapsed ms.

4. Frontend type additions in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/types/utilities.ts`:
- `TimerMode`
- `TimerStateData`
- `TextFormat`

5. Frontend wrapper/hook additions:
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/tauri.ts`
- `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/lib/queries.ts`

## Execution Batches

### Batch 0 — Presentation Slide Sidebar Hotfix (blocking)
- Goal: fix clipped slide items in the presentation editor sidebar.
- Status: COMPLETE (2026-02-17).
- Implement:
1. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/presentations/$presentationId.tsx`
: Keep 3-panel layout.
: Increase slide sidebar width from `w-52` to `w-56`.
: Keep rounded border container.
: Keep `overflow-hidden` on panel container.
2. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/slides/slide-list.tsx`
: Add right padding to list content container to avoid overlay scrollbar clipping thumbnails.
: Change list content container from `p-2` to `p-2 pr-3`.
: Add `min-w-0` to sortable thumbnail wrapper (`div` wrapping `SlideThumbnail`) so flex children can shrink correctly in constrained width.
3. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/slides/slide-thumbnail.tsx`
: Keep full-width behavior.
: Make active ring inset (`ring-inset`) to avoid visual edge clipping within constrained containers.
4. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/slides/slide-renderer.tsx`
: Add dedicated thumbnail-safe video label rendering (wrapped/broken text instead of nowrap truncation) so long filenames cannot force card overflow.
- Verify:
: Manual visual checks at 100%, 125%, and 150% zoom.
: Sidebar remains usable with drag handle, duplicate, and delete controls.
: `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
: `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`
- Evidence:
: User-confirmed fix after retest with video type + selected file.
: Static verification commands passed.
: Lessons captured in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-09-utilities-polish/LEARNINGS.md`.

### Batch 1 — Backend Timer + Utility Core
- Implement timer state machine and commands.
- Implement `run_lottery` and `format_text`.
- Register commands in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/src/lib.rs`.

### Batch 2 — Frontend Types, Wrappers, Queries
- Add utilities types file.
- Add Tauri wrappers and React Query hooks.
- Set timer polling cadence (250ms running, slower idle).

### Batch 3 — Utilities Routing and Pages
- Replace placeholder `/utilities` flat route with directory route structure:
1. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/utilities/route.tsx`
2. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/utilities/index.tsx`
3. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/utilities/timer.tsx`
4. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/utilities/clock.tsx`
5. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/utilities/lottery.tsx`
6. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/utilities/text.tsx`

### Batch 4 — Utility Components
- Create:
1. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/utilities/timer-display.tsx`
2. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/utilities/clock-display.tsx`
3. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/utilities/lottery-animation.tsx`
4. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/utilities/keyboard-shortcuts-panel.tsx`

### Batch 5 — Projection Integration
- Integrate utility projection lifecycle into:
1. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/slides/projector-view.tsx`
2. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routes/return.tsx`
- Preserve existing slide projection behavior.

### Batch 6 — Command Palette + Status + Theme Polish
- Expand actions in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/ui/command-palette.tsx`.
- Add timer compact status in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/components/layout/status-bar.tsx`.
- Finalize theme behavior in `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/global.css` and `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/stores/theme-store.ts`.

### Batch 7 — Localization + Route Tree + Final Validation
- Update:
1. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/en.json`
2. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/pt.json`
3. `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/locales/es.json`
- Regenerate `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src/routeTree.gen.ts`.
- Run final full checks.

## Test Cases and Scenarios
1. Presentation sidebar fix:
- Open presentation editor with many slides.
- Confirm no clipping in slide cards and active ring.
- Confirm drag-and-drop still works.

2. Timer:
- Countdown start/pause/resume/reset.
- Stopwatch start/pause/resume/reset + lap.
- Invalid countdown duration returns clear backend error.

3. Lottery:
- Reject empty/blank input list.
- Winner always belongs to sanitized names set.

4. Text formatter:
- Validate uppercase/lowercase/title_case/sentence_case output.
- Invalid format returns clear backend error.

5. Projection regression:
- Utility projection works.
- Hymn/Bible/presentation/video projection remains unchanged after utilities flow.

6. Static checks:
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec tsc --noEmit`
- `cargo check --manifest-path /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/src-tauri/Cargo.toml`
- `pnpm -C /Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform exec vite build`

## Assumptions and Defaults
1. The sidebar clipping fix is mandatory and blocks Phase 09 feature work.
2. Timer updates are poll-driven from frontend; no continuous backend emitter loop in this phase.
3. No new DB migration is required for core Phase 09 utilities.
4. Existing non-utility stubs outside Phase 09 scope are not expanded unless directly required.
5. TASKS file location is fixed at `/Users/lojaintegrada/Documents/projects/personal/louvorja-multiplataform/docs/phase-09-utilities-polish/TASKS.md`.
