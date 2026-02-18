# Code Review Fixes And Suggestions

This document consolidates the review findings into an implementation-ready plan with concrete fixes, file targets, and validation steps.

---

## 1. Blocking fixes (apply before merge)

### 1.1 Fix deadlock in `audio_pause` (Critical)

- Severity: `CRITICAL`
- File: `src-tauri/src/commands/audio.rs:149`

#### Problem

`audio_pause` locks `AudioState.player`, calls `player.pause()`, and then calls `emit_audio_status(...)` while the same lock is still held.

#### Root cause

`emit_audio_status` calls `snapshot_audio_status`, which tries to lock `AudioState.player` again, causing lock re-entry on a non-reentrant mutex.

#### Fix

1. Drop the player lock before calling `emit_audio_status`.
2. Keep behavior aligned with `audio_resume`, `audio_stop`, `audio_seek`, and `audio_set_volume`, which already release lock before status emission.

#### Suggested patch

```rust
#[tauri::command]
pub fn audio_pause(
    app: AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<(), AppError> {
    let player = state
        .player
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    player.pause();
    drop(player); // required to avoid deadlock
    let _ = emit_audio_status(&app, &state)?;
    Ok(())
}
```

#### Verification

1. Start audio playback.
2. Pause from UI and from command palette.
3. Confirm no freeze and status updates continue.
4. Run: `cargo test` and `pnpm test`.

---

### 1.2 Keep collections search index fresh after slide edits (Medium)

- Severity: `MEDIUM`
- Files:
  - `src-tauri/src/db/queries/collections.rs:142`
  - `src-tauri/src/db/queries/slides.rs:174`

#### Problem

`collections_fts` song documents include aggregated slide content (`GROUP_CONCAT(s.content, ' ')`), but slide CRUD paths do not trigger FTS reindex. Search can return stale content after editing a presentation already linked to collection songs.

#### Root cause

FTS indexing is triggered on collection/song mutations, but not on slide mutations that affect cached presentation content.

#### Fix

1. Add a helper in `src-tauri/src/db/queries/collections.rs`:
   - `reindex_collection_song_documents_by_presentation(conn: &Connection, presentation_id: i64) -> Result<(), AppError>`
2. Helper query:
   - `SELECT id, collection_id FROM collection_songs WHERE cache_presentation_id = ?1`
   - For each row:
     - call `upsert_collection_song_search_document(conn, song_id)?`
     - call `upsert_collection_search_document(conn, collection_id)?`
3. Call this helper from slide mutation points in `src-tauri/src/db/queries/slides.rs`:
   - `insert_slide_with_metadata(...)` after insert/touch.
   - `update_slide(...)` after update/touch.
   - `delete_slide(...)` after delete/reindex/touch.
4. Optionally call from `update_slide_orders(...)` only if you decide ordering should affect snippets (usually not required).

#### Verification

1. Create/import a collection song linked to cached presentation.
2. Search for a token from existing slide text: should return hit.
3. Edit slide text and replace token.
4. Search old token: no hit.
5. Search new token: hit.

---

### 1.3 Preserve valid absolute audio paths in legacy playback normalization (Medium)

- Severity: `MEDIUM`
- Files:
  - `src/routes/collections/$collectionId.tsx:668`
  - `src-tauri/src/commands/audio.rs:267`

#### Problem

`normalizeMediaPath` always prefixes non-`media/` values with `media/`. Absolute paths become invalid (`media/C:/...`, `media//Users/...`) before backend resolution.

#### Root cause

Frontend normalization is too aggressive and does not preserve already-valid absolute paths/URLs.

#### Fix

1. Update `normalizeMediaPath` to preserve:
   - absolute POSIX path (`/...`)
   - absolute Windows path (`C:\...` or `C:/...`)
   - explicit URL/data/blob formats (`http://`, `https://`, `data:`, `blob:`)
2. Only prefix `media/` for truly relative paths.

#### Suggested implementation

```ts
function normalizeMediaPath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized) return null;

  const isAbsolutePosix = normalized.startsWith("/");
  const isAbsoluteWindows = /^[a-zA-Z]:\//.test(normalized);
  const isExternal = /^(https?:|data:|blob:)/i.test(normalized);

  if (isAbsolutePosix || isAbsoluteWindows || isExternal) {
    return normalized;
  }

  return normalized.startsWith("media/") ? normalized : `media/${normalized}`;
}
```

#### Verification

1. Test playback with:
   - `media/...` relative path
   - absolute local path
   - imported legacy path variants
2. Confirm `audio_play` resolves and plays all valid variants.

---

## 2. High-value non-blocking improvements

### 2.1 Make Clippy clean pass part of merge gate

Current command fails:

```bash
cargo clippy --all-targets --all-features -- -D warnings
```

Main issues:

1. `too_many_arguments` in command/query/streaming functions.
2. `redundant_closure` in several `map_err` / `query_map` calls.

Suggested approach:

1. Introduce parameter structs for large function signatures (instead of suppressing lints).
2. Replace closures with direct function/variant references where possible.
3. Keep `-D warnings` in CI to prevent regressions.

---

### 2.2 Reduce frontend bundle size

Build warning indicates a large JS chunk (~989 kB).

Suggested actions:

1. Lazy-load heavy routes (hymnal/collections/settings editor-heavy views).
2. Split command palette dependencies if possible.
3. Add manual chunking in Vite for large vendor groups.

Validation:

```bash
pnpm build
```

Compare chunk sizes before/after.

---

### 2.3 Remove duplicated media path resolution logic

Similar logic now exists in:

1. `src/hooks/use-media-source.ts`
2. `src/components/slides/slide-renderer.tsx` (`useResolvedMediaPath`)

Suggested action:

1. Keep a single reusable hook (`useMediaSource`).
2. Replace local resolver in `SlideRenderer` with shared hook.
3. Keep one cache strategy and one bug surface.

---

## 3. Suggested execution order

1. Fix `audio_pause` deadlock.
2. Fix path normalization behavior.
3. Add FTS reindex-on-slide-change.
4. Add/extend regression tests for all 3 fixes.
5. Clean Clippy warnings.
6. Apply bundle-splitting improvements.

---

## 4. Validation checklist

Run all:

```bash
pnpm test
pnpm build
cargo test
cargo clippy --all-targets --all-features -- -D warnings
```

Manual scenarios:

1. Play/pause/resume/stop audio repeatedly while projecting.
2. Edit slide content and verify `search_collections` freshness.
3. Play songs with relative and absolute paths.
4. Confirm projector/return flows still work for image/video/background slides.

