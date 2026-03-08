# Lyrics Sync Playback Fix Task Breakdown

Source plan:
- `docs/plans/2026-03-07-lyrics-sync-playback-fix.md`

## Execution Order

1. Task 1: Schema migration for karaoke override support
2. Task 2: Rust sync query/save refactor
3. Task 3: Shared frontend sync resolution helper
4. Task 4: Audio store mode-aware live sync
5. Task 5: Manual seek and Playing now mode-switch fix
6. Task 6: Sync editor data-preservation fix
7. Task 7: Cleanup of lossy and noisy code
8. Task 8: Rust test coverage
9. Task 9: Frontend test coverage
10. Task 10: End-to-end verification

## Task 1: Schema Migration For Karaoke Overrides

**Goal:** Preserve instrumental/karaoke override timestamps in the database.

**Files:**
- `src-tauri/src/db/migrations.rs`

**Work:**
- Add a new migration that adds `instrumental_timestamp_ms INTEGER` to `audio_sync_points`.
- Keep the existing `timestamp_ms` column for sung timing.
- Ensure existing databases migrate without deleting rows.

**Acceptance Criteria:**
- Existing databases keep current sync points.
- New databases include `instrumental_timestamp_ms`.
- No schema downgrade or destructive reset is required.

**Depends on:** None

## Task 2: Refactor Rust Sync Read/Write Logic

**Goal:** Stop dropping karaoke timing when reading or saving sync points.

**Files:**
- `src-tauri/src/db/queries/music.rs`

**Work:**
- Parse baseline sync points from `lyrics_sync`.
- Merge `audio_sync_points` overrides on top of baseline instead of replacing the richer timeline completely.
- Save both `timestamp_ms` and `instrumental_timestamp_ms`.
- Remove the old assumption that manual overrides only apply to default audio.

**Acceptance Criteria:**
- `get_sync_points` returns both vocal and instrumental timestamps when available.
- Saving sync points no longer erases karaoke timing.
- Table overrides remain compatible with existing rows that only have sung timing.

**Depends on:** Task 1

## Task 3: Create Shared Frontend Sync Helper

**Goal:** Centralize timestamp selection so all playback paths use the correct timeline.

**Files:**
- `src/lib/audio-sync.ts`

**Work:**
- Add helpers to:
  - choose the active timestamp for `sung` vs `karaoke`
  - sort sync points for the active mode
  - find the active slide from a playback position
  - resolve the correct seek time for a target slide

**Acceptance Criteria:**
- Karaoke mode prefers `instrumentalTimestampMs`.
- Sung mode continues using `timestampMs`.
- Fallback to sung timing still works when no karaoke timing exists.

**Depends on:** Task 2

## Task 4: Make Live Playback Sync Mode-Aware

**Goal:** Ensure automatic slide advancement uses the correct sync lane.

**Files:**
- `src/stores/audio-store.ts`

**Work:**
- Replace direct `timestampMs` comparisons with the new shared helper.
- Remove the global `timestampMs` sort inside `setSyncPoints`.
- Use the active `playbackMode` when determining which slide should be projected.

**Acceptance Criteria:**
- Karaoke playback advances slides using instrumental timing.
- Sung playback behavior remains unchanged.
- Raw sync points are not reordered destructively at store-ingest time.

**Depends on:** Task 3

## Task 5: Fix Manual Seek And Playing now Mode Switching

**Goal:** Make seeking and mode changes respect the active sync timeline.

**Files:**
- `src/hooks/use-slides.ts`
- `src/routes/playing-now/index.tsx`

**Work:**
- Update manual slide navigation to use mode-aware seek resolution.
- Update Playing now karaoke/sung mode switches to seek into the correct timeline.
- Remove direct `timestampMs` seek logic from these paths.

**Acceptance Criteria:**
- Clicking a slide while in karaoke seeks to the karaoke timestamp.
- Switching from sung to karaoke no longer lands on the wrong time.
- Hymnal and API-backed collection playback use the same corrected logic.

**Depends on:** Task 4

## Task 6: Fix Sync Editor To Preserve Both Timelines

**Goal:** Stop the editor from wiping karaoke timing when saving.

**Files:**
- `src/components/music/audio-sync-editor.tsx`

**Work:**
- Remove `instrumentalTimestampMs: null` from new/updated points.
- When editing sung sync, preserve the existing karaoke value.
- When editing karaoke sync, preserve the existing sung value.
- Show which sync lane is currently being edited.

**Acceptance Criteria:**
- Editing sung sync does not erase karaoke sync.
- Editing karaoke sync does not erase sung sync.
- The active editing mode is visible in the UI.

**Depends on:** Task 3

## Task 7: Remove Problematic And Noisy Code

**Goal:** Clean up code that encodes the old broken assumptions or adds debugging noise.

**Files:**
- `src/stores/audio-store.ts`
- `src/lib/queries.ts`
- `src-tauri/src/db/queries/music.rs`

**Work:**
- Remove temporary `console.log` / debug statements used for sync debugging.
- Remove stale comments that state or imply only sung/default timing matters.
- Keep legacy custom-collection calibration code unchanged in this fix.

**Acceptance Criteria:**
- No remaining debug noise in the corrected sync path.
- Comments reflect the new dual-timeline model.
- No unrelated legacy collection code is modified.

**Depends on:** Tasks 2, 4, 5, 6

## Task 8: Add Rust Regression Tests

**Goal:** Lock the backend behavior so karaoke timing cannot regress silently.

**Files:**
- `src-tauri/src/db/queries/music.rs`
- Optional: `src-tauri/src/db/queries/music_sync_tests.rs`

**Work:**
- Add tests for `parse_time_to_ms`.
- Add tests for `get_sync_points` baseline parsing from `lyrics_sync`.
- Add tests for merged override behavior.
- Add tests for save/load round-trip with `instrumental_timestamp_ms`.

**Acceptance Criteria:**
- Backend tests cover both sung and instrumental timing.
- Override merge logic is verified explicitly.
- Existing single-lane rows remain supported.

**Depends on:** Tasks 1, 2

## Task 9: Add Frontend Regression Tests

**Goal:** Lock the frontend behavior so playback mode always selects the correct timeline.

**Files:**
- `src/lib/audio-sync.ts`
- `tests/lib/audio-sync.test.ts`
- `tests/stores/audio-store.test.ts`
- `package.json`

**Work:**
- Add unit tests for the shared sync helper.
- Add store-level tests for live slide selection behavior.
- Add the new test files to the existing `pnpm test:unit` command.

**Acceptance Criteria:**
- Karaoke mode uses instrumental timestamps in tests.
- Sung mode uses vocal timestamps in tests.
- Store tests prove the correct slide is selected for both modes.

**Depends on:** Tasks 3, 4, 5

## Task 10: Manual Verification And Release Check

**Goal:** Confirm the bug is fixed in real user flows.

**Files:**
- No new code files required

**Work:**
- Run backend tests.
- Run frontend unit tests.
- Run a production build.
- Manually verify hymnal playback in sung and karaoke modes.
- Manually verify API-backed collection playback in sung and karaoke modes.
- Manually verify saving a sync point in one mode preserves the other mode.

**Acceptance Criteria:**
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `pnpm test:unit` passes.
- `pnpm build` passes.
- Real playback matches the API sync points in both modes.

**Depends on:** Tasks 1 through 9

## Suggested Implementation Batches

### Batch A: Backend correctness
- Task 1
- Task 2
- Task 8

### Batch B: Frontend sync resolution
- Task 3
- Task 4
- Task 5
- Task 9

### Batch C: Editing and cleanup
- Task 6
- Task 7
- Task 10

## Notes

- Do not move lyrics into a separate table as part of this fix.
- Do not modify `src/routes/collections/$collectionId.tsx` legacy custom-collection sync parsing unless a new reproduction proves it is part of the same bug.
- The key removal items in this work are:
  - vocal-only sync resolution
  - vocal-only sorting in the audio store
  - hardcoded `instrumentalTimestampMs: null` in the sync editor
  - stale comments that describe overrides as sung-only
