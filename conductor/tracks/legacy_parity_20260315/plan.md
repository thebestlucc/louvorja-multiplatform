# Implementation Plan: Legacy Desktop Parity

## Phase 1: Favorites System (High Priority)
- [x] 1. Add `toggle_favorite` and `get_favorites` Rust commands in `src-tauri/src/commands/favorites.rs`. [7f04397]
- [ ] 2. Register the commands in `src-tauri/src/lib.rs` and update bindings.
- [ ] 3. Update `src/lib/queries.ts` to include TanStack Query hooks for reading and mutating favorites.
- [ ] 4. Add a favorite toggle button (star icon) to `HymnCard` and Hymn Detail (`$hymnId.tsx`).
- [ ] 5. Add a "Favorites" tab or filter in the Hymnal index route (`src/routes/hymnal/index.tsx`).

## Phase 2: Interactive Text & Alerts (High Priority)
- [ ] 1. Create Rust commands and state in `src-tauri/src/commands/display.rs` (or a new module) to hold active alert/ticker state.
- [ ] 2. Update the `SseBroadcaster` and streaming templates (`music.html`, `bible.html`, `return.html`) to receive and render alerts.
- [ ] 3. Create frontend route `/utilities/interactive-text` with controls for text input, display mode (static/ticker), and projection trigger.
- [ ] 4. Update the React projector view (`src/routes/projector.tsx` and `return.tsx`) to render the alert overlay on top of existing slides.

## Phase 3: Monitor Identification Helper (Medium Priority)
- [ ] 1. Add Rust command `identify_monitors` in `src-tauri/src/commands/display.rs` that briefly opens a transparent, borderless window on each connected monitor displaying its index number.
- [ ] 2. Update `src/routes/settings/index.tsx` to add an "Identify Monitors" button near the display settings.
- [ ] 3. Connect the frontend button to the `identify_monitors` backend command.

## Phase 4: Collection Integrity Tools (Medium Priority)
- [ ] 1. Create Rust command `scan_media_integrity` in `src-tauri/src/commands/utility.rs` to check for missing and excess files in the `media/` folder compared to database references.
- [ ] 2. Create frontend route `/utilities/integrity` to display the scan results (missing files list, excess files list).
- [ ] 3. Add a "Clean up excess files" action to delete unreferenced media via backend command.
