# Lyrics Sync Playback Fix Plan

## Goal

Fix lyric sync for hymnal songs and API-backed collections when the API already returns valid `time` and `instrumental_time` values, and remove the lossy code paths that currently discard or ignore karaoke timing.

## Confirmed Root Cause

1. The API import already stores both vocal and instrumental sync data in `lyrics_sync`.
2. The frontend playback layer always uses `timestampMs`, even in karaoke mode.
3. Manual overrides in `audio_sync_points` are lossy because the table stores only `timestamp_ms`, and `get_sync_points` prefers that table over the richer `lyrics_sync` JSON.
4. The current sync editor explicitly writes `instrumentalTimestampMs: null`, which can destroy karaoke timing on save.

## Scope

In scope:
- Hymnal playback
- API-backed collection playback
- Manual sync editing for hymns
- Rust persistence/query layer for sync points
- Frontend sync resolution and seeking

Out of scope for this fix:
- Custom imported collection slides using `legacy.tempo_ms` / `legacy.tempo_hms`
- Reworking lyric storage into a separate lyrics table
- Changes to API ordering logic

## Architecture Decision

Treat `lyrics_sync` as the baseline source of truth for both vocal and instrumental timelines, and treat `audio_sync_points` as an override layer that must preserve both timelines instead of replacing them with a single-timeline representation.

## Files To Modify

- `src-tauri/src/db/migrations.rs`
- `src-tauri/src/db/queries/music.rs`
- `src/components/music/audio-sync-editor.tsx`
- `src/stores/audio-store.ts`
- `src/hooks/use-slides.ts`
- `src/routes/playing-now/index.tsx`
- `src/lib/queries.ts`
- `package.json`

## Files To Add

- `src/lib/audio-sync.ts`
- `tests/lib/audio-sync.test.ts`

Optional if existing Rust tests are too crowded:
- `src-tauri/src/db/queries/music_sync_tests.rs`

## Batch 1: Preserve Both Timelines In Storage

### Task 1: Add instrumental override support to `audio_sync_points`

**Target:** backend  
**Working Directory:** `.`  
**Agent:** `ring:backend-engineer-typescript` is not applicable; implement in Rust backend workflow

**File:**
- `src-tauri/src/db/migrations.rs`

**Change:**
- Add a new migration that adds `instrumental_timestamp_ms INTEGER` to `audio_sync_points`.
- Do not alter or delete existing rows.

**Implementation detail:**

```rust
add_column_if_missing(
    conn,
    "audio_sync_points",
    "instrumental_timestamp_ms",
    "INTEGER",
)?;
```

**Verification:**
- Existing databases migrate without data loss.
- New installs still create a valid schema.

### Task 2: Stop treating `audio_sync_points` as a lossy replacement

**File:**
- `src-tauri/src/db/queries/music.rs`

**Change:**
- Parse baseline sync points from `lyrics_sync` first.
- When override rows exist, merge them by `slide_index`:
  - `timestamp_ms` comes from the override row.
  - `instrumental_timestamp_ms` comes from:
    1. override row if present
    2. otherwise matching baseline `lyrics_sync` row
    3. otherwise `None`
- Keep the cover point at slide `0`.

**Remove problematic behavior:**
- Remove the current “table rows win completely” behavior that drops karaoke timing.
- Remove the outdated comment that manual overrides only apply to default audio.

**Implementation shape:**

```rust
let baseline = parse_lyrics_sync_points(...); // returns Vec<SyncPoint>
let baseline_by_slide = HashMap<usize, SyncPoint>;

if override_rows.is_empty() {
    return Ok(baseline);
}

let merged = override_rows.map(|row| SyncPoint {
    slide_index: row.slide_index,
    timestamp_ms: row.timestamp_ms,
    instrumental_timestamp_ms: row.instrumental_timestamp_ms
        .or_else(|| baseline_by_slide.get(&row.slide_index).and_then(|p| p.instrumental_timestamp_ms)),
});
```

### Task 3: Save both timelines during manual overrides

**File:**
- `src-tauri/src/db/queries/music.rs`

**Change:**
- Update `save_sync_points` to insert `instrumental_timestamp_ms` as well as `timestamp_ms`.
- Update the insert SQL accordingly.

**Replace:**

```sql
INSERT INTO audio_sync_points (hymn_id, slide_index, timestamp_ms)
VALUES (?1, ?2, ?3)
```

**With:**

```sql
INSERT INTO audio_sync_points (
  hymn_id,
  slide_index,
  timestamp_ms,
  instrumental_timestamp_ms
)
VALUES (?1, ?2, ?3, ?4)
```

## Batch 2: Make Frontend Sync Resolution Mode-Aware

### Task 4: Centralize timestamp selection by playback mode

**Files:**
- `src/lib/audio-sync.ts`
- `src/hooks/use-slides.ts`
- `src/stores/audio-store.ts`
- `src/routes/playing-now/index.tsx`

**Change:**
- Create a shared helper module that chooses the active timestamp for a sync point:
  - `karaoke` uses `instrumentalTimestampMs` when present
  - otherwise fall back to `timestampMs`
- Move the “find slide at current position” and “seek to slide” logic into this shared helper.

**Functions to create in `src/lib/audio-sync.ts`:**

```ts
export function getActiveTimestamp(point: SyncPoint, mode: PlaybackMode): number
export function sortSyncPointsForMode(points: SyncPoint[], mode: PlaybackMode): SyncPoint[]
export function findSlideAtPosition(points: SyncPoint[], positionMs: number, mode: PlaybackMode): number
export function resolveSlideSeekTimestamp(points: SyncPoint[], slideIndex: number, mode: PlaybackMode): number | null
```

**Why:**
- Current code hardcodes `timestampMs` in multiple places.
- A shared helper prevents the same bug from surviving in one route while being fixed in another.

### Task 5: Remove the global vocal-only sort from the audio store

**File:**
- `src/stores/audio-store.ts`

**Change:**
- Remove the current `setSyncPoints` sort by `timestampMs`.
- Resolve ordering inside `sortSyncPointsForMode()` based on the active mode.

**Remove problematic code:**

```ts
const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
set({ syncPoints: sorted, lastSyncSlide: -1 });
```

**Replace with:**

```ts
set({ syncPoints: [...points], lastSyncSlide: -1 });
```

Then update live sync code to call the shared helper with `get().playbackMode`.

### Task 6: Make manual seeking use the active timeline

**Files:**
- `src/hooks/use-slides.ts`
- `src/routes/playing-now/index.tsx`

**Change:**
- Update manual slide navigation and karaoke mode switching to call the shared `resolveSlideSeekTimestamp(points, slideIndex, playbackMode)`.
- When the user changes from sung to karaoke in Playing now, seek using the karaoke timeline, not the sung timeline.

**Remove problematic behavior:**
- Direct use of `point.timestampMs` in seek resolution.

## Batch 3: Remove Lossy Sync Editor Behavior

### Task 7: Stop nulling the karaoke timeline on save

**File:**
- `src/components/music/audio-sync-editor.tsx`

**Change:**
- Remove the hardcoded `instrumentalTimestampMs: null`.
- When recording a point:
  - if mode is `sung`, update only `timestampMs`
  - if mode is `karaoke`, update only `instrumentalTimestampMs`
  - preserve the other field from the existing point if present

**Remove problematic code:**

```ts
instrumentalTimestampMs: null
```

**Replace with logic like:**

```ts
const existing = prev.find((p) => p.slideIndex === slideIndex);

const newPoint: SyncPoint = {
  slideIndex,
  timestampMs: playbackMode === "karaoke"
    ? (existing?.timestampMs ?? 0)
    : positionMs,
  instrumentalTimestampMs: playbackMode === "karaoke"
    ? positionMs
    : (existing?.instrumentalTimestampMs ?? null),
};
```

### Task 8: Make the editor explicit about which lane is being edited

**File:**
- `src/components/music/audio-sync-editor.tsx`

**Change:**
- Show a small label or badge such as `Editing sung sync` / `Editing karaoke sync`.
- If the team wants a smaller first fix, keep the UI minimal but at least expose the current mode clearly.

## Batch 4: Clean Up Debugging and Dead Assumptions

### Task 9: Remove sync-path logging and stale comments

**Files:**
- `src/stores/audio-store.ts`
- `src/lib/queries.ts`
- `src-tauri/src/db/queries/music.rs`

**Change:**
- Remove noisy `console.log` / debug lines that were useful during investigation but are not part of the product behavior.
- Remove comments that encode the old assumption that only the default timeline matters.

**Why:**
- The logging is not the root cause, but it adds noise and makes the fixed flow harder to reason about.

### Task 10: Do not touch custom collection calibration in this fix

**Files intentionally not modified:**
- `src/routes/collections/$collectionId.tsx`

**Reason:**
- That code handles legacy imported slide decks, not the confirmed API-backed hymnal / collection sync bug.
- Leave it unchanged unless a separate reproduction proves it is involved.

## Test Plan

### Rust tests

**File:**
- `src-tauri/src/db/queries/music.rs` or a dedicated test module

**Add tests for:**
- `parse_time_to_ms("00:00:03") == 3000`
- `get_sync_points()` returns `instrumental_timestamp_ms` from `lyrics_sync`
- `get_sync_points()` merges override rows with baseline karaoke timing when the override row has no instrumental value
- `save_sync_points()` round-trips both timestamps

### Frontend tests

**Files:**
- `tests/lib/audio-sync.test.ts`
- `tests/stores/audio-store.test.ts`

**Add tests for:**
- `karaoke` mode selects `instrumentalTimestampMs`
- `sung` mode selects `timestampMs`
- `findSlideAtPosition()` uses the active timeline
- `resolveSlideSeekTimestamp()` uses the active timeline
- store sync changes slide correctly when playback mode changes

### Test runner update

**File:**
- `package.json`

**Change:**
- Add the new compiled test file to the `pnpm exec node --test ...` list in `test:unit`.

## Verification Commands

Run after implementation:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
pnpm test:unit
pnpm build
```

Manual verification:

1. Restore or open a hymn that has both `time` and `instrumental_time`.
2. Start sung mode and verify slide changes match the vocal audio.
3. Switch to karaoke and verify slide changes jump to the instrumental timeline.
4. Open the sync editor, record a karaoke sync point, save, reload, and confirm the sung timing still exists.
5. Repeat with an API-backed collection item, since it reuses the same hymn playback path.

## Failure Recovery

If schema migration lands but frontend changes are not ready:
- Keep reading baseline instrumental timestamps from `lyrics_sync`.
- Do not enable any UI path that saves karaoke overrides yet.

If frontend mode-aware sync lands before the migration:
- The app should still improve immediately for hymns using `lyrics_sync`.
- Manual overrides will remain partially lossy until the migration and save-path changes are completed.

## Recommended Execution Order

1. `src-tauri/src/db/migrations.rs`
2. `src-tauri/src/db/queries/music.rs`
3. `src/lib/audio-sync.ts`
4. `src/stores/audio-store.ts`
5. `src/hooks/use-slides.ts`
6. `src/routes/playing-now/index.tsx`
7. `src/components/music/audio-sync-editor.tsx`
8. `tests/lib/audio-sync.test.ts`
9. `tests/stores/audio-store.test.ts`
10. `package.json`

## Zero-Context Test

Another engineer should be able to execute this plan without extra explanation if they know only:
- Rust sync data comes from `lyrics_sync` and `audio_sync_points`
- karaoke should prefer `instrumentalTimestampMs`
- manual overrides must not erase the untouched timeline
