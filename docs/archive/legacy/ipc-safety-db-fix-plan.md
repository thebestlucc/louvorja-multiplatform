# LouvorJA — IPC, Safety & DB Fix Plan

## Context

Three rounds of analysis (Microsoft Rust Guidelines, IPC patterns, streaming/audio/DB) identified concrete bugs and reliability issues. This plan documents and prioritizes all confirmed fixes. Changes are grouped by risk and impact: Group 1 fixes real bugs; Group 2 fixes reliability; Group 3 are quick wins with no architectural risk.

**No new features. No refactors beyond the targeted fixes.**

---

## Group 1 — Real Bugs (highest priority)

### 1.1 Deadlock: `toggle_black_screen` ↔ `toggle_logo_screen`

**File:** `src-tauri/src/commands/display.rs:819–868`
**File:** `src-tauri/src/state.rs:169–170`
**File:** `src-tauri/src/lib.rs:72–73`

**Problem:** Classic ABBA deadlock. Both commands acquire two mutexes in opposite order:
- `toggle_black_screen`: locks `is_black_screen` → then `is_logo_screen`
- `toggle_logo_screen`: locks `is_logo_screen` → then `is_black_screen`

**Fix:** Replace both `Mutex<bool>` fields with a single `Mutex<OverlayRuntimeState>` struct.

**Step 1 — `state.rs`:** Add new struct, replace the two fields:
```rust
// Add above AppState:
#[derive(Debug, Default)]
pub struct OverlayRuntimeState {
    pub is_black_screen: bool,
    pub is_logo_screen: bool,
}

// In AppState — replace:
//   pub is_black_screen: Mutex<bool>,
//   pub is_logo_screen: Mutex<bool>,
// With:
pub overlay: Mutex<OverlayRuntimeState>,
```

**Step 2 — `lib.rs`:** Update initialization:
```rust
// Replace:
//   is_black_screen: Mutex::new(false),
//   is_logo_screen: Mutex::new(false),
// With:
overlay: Mutex::new(OverlayRuntimeState::default()),
```

**Step 3 — `commands/display.rs`:** Rewrite both commands to take the single lock:
```rust
pub fn toggle_black_screen(...) -> Result<OverlayState, AppError> {
    let mut overlay = state.overlay.lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    overlay.is_black_screen = !overlay.is_black_screen;
    if overlay.is_black_screen { overlay.is_logo_screen = false; }
    let result = OverlayState { black_screen: overlay.is_black_screen, logo_screen: overlay.is_logo_screen };
    let _ = app.emit("overlay-changed", &result);
    Ok(result)
}

pub fn toggle_logo_screen(...) -> Result<OverlayState, AppError> {
    let mut overlay = state.overlay.lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    overlay.is_logo_screen = !overlay.is_logo_screen;
    if overlay.is_logo_screen { overlay.is_black_screen = false; }
    let result = OverlayState { black_screen: overlay.is_black_screen, logo_screen: overlay.is_logo_screen };
    let _ = app.emit("overlay-changed", &result);
    Ok(result)
}
```

**Step 4 — `commands/display.rs` — `get_overlay_state`:** Update to use `state.overlay.lock()` instead of two separate locks (line 871–884).

**All usages confirmed confined to:** `lib.rs:72–73`, `state.rs:169–170`, `display.rs:819–884`. No other files reference these fields.

---

### 1.2 IPC Blocking: `copy_video_to_media` runs blake3 hash + `fs::copy` on IPC thread

**File:** `src-tauri/src/commands/utility.rs:47–116`

**Problem:** For a 2 GB video, blake3 hashing + `fs::copy` can take 10–30 seconds on the IPC handler thread. On Windows, this freezes the entire IPC bridge for all `invoke()` calls.

**Fix:** Spawn background thread, return immediately, emit completion event.

```rust
#[tauri::command]
pub fn copy_video_to_media(
    video_path: String,
    presentation_id: i64,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    // Validate before spawning (fast DB check + path existence)
    {
        let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM presentations WHERE id = ?1",
            rusqlite::params![presentation_id], |row| row.get(0))?;
        if exists == 0 {
            return Err(AppError::NotFound(format!("Presentation {} not found", presentation_id)));
        }
    }
    let source = PathBuf::from(&video_path);
    if !source.exists() {
        return Err(AppError::NotFound(format!("Video file '{}' not found", source.display())));
    }
    // Spawn heavy work on background thread
    let app_clone = app.clone();
    std::thread::spawn(move || {
        match do_copy_video_work(&video_path, presentation_id, &app_clone) {
            Ok(rel_path) => { let _ = app_clone.emit("video-copy-complete", (presentation_id, rel_path)); }
            Err(e)       => { let _ = app_clone.emit("video-copy-error",    (presentation_id, e.to_string())); }
        }
    });
    Ok(())
}

fn do_copy_video_work(video_path: &str, presentation_id: i64, app: &AppHandle) -> Result<String, AppError> {
    // Move existing blake3 hash + fs::copy logic here (lines 63–116 of current utility.rs)
}
```

**Frontend impact:** The TypeScript wrapper `copyVideoToMedia` in `src/lib/tauri.ts:544` currently returns `Promise<string>`. After this change, the command returns `Promise<void>`. The caller must listen for `"video-copy-complete"` / `"video-copy-error"` events to get the result. Update `tauri.ts` accordingly.

**Note:** `copy_image_to_media` (`utility.rs:120–195`) does the same pattern but is bounded by `MAX_COVER_SIZE_BYTES` (8 MB) so the impact is lower. Apply the same background-thread fix for consistency.

---

### 1.3 IPC Blocking: `get_video_metadata` waits up to 4 seconds for ffprobe

**File:** `src-tauri/src/commands/utility.rs:195–253`

**Problem:** `video::parse_video_metadata_with_ffprobe(..., 4000)` blocks the IPC thread for up to 4 seconds waiting for a subprocess.

**Fix:** Make the command `async` using `tokio::task::spawn_blocking`. Tauri 2 supports `async` commands natively.

```rust
#[tauri::command]
pub async fn get_video_metadata(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<VideoMetadata, AppError> {
    // Keep the fast path (path resolution + file existence check) synchronous
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let resolved_path = /* same resolution logic */;
    if !resolved_path.exists() {
        return Err(AppError::NotFound(...));
    }
    // Load ffprobe settings (fast DB read) before spawning
    let (ffprobe_enabled, ffprobe_path) = {
        let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        load_ffprobe_settings_from_conn(&conn)?
    };
    // Offload blocking metadata parsing
    tokio::task::spawn_blocking(move || {
        /* native parse + ffprobe fallback logic — identical to current lines 217–249 */
    })
    .await
    .map_err(|e| AppError::Internal(format!("Metadata task panicked: {}", e)))?
}
```

**Note:** The `load_ffprobe_settings` helper currently acquires `state.db.lock()` internally. It must be refactored to accept a `&Connection` directly so the lock is not re-acquired inside the `spawn_blocking` closure (which cannot hold `tauri::State` references).

---

## Group 2 — Reliability

### 2.1 Missing DB Transactions

**Three functions perform multi-step writes with no transaction. A failure mid-operation leaves the DB in an inconsistent state.**

rusqlite 0.31 transaction pattern (confirmed used in `migration/hymn_importer.rs`):
```rust
let tx = conn.transaction()?;
// ... execute on &tx ...
tx.commit()?;
```

#### 2.1a `delete_slide` — `src-tauri/src/db/queries/slides.rs:220–258`

Current: DELETE (line 235) + N individual UPDATE statements (lines 244–248) + UPDATE presentations + reindex call — no transaction.

Fix: Wrap entire function body in `conn.transaction()`. Also replace the N-row per-slide re-index with a single SQL statement:
```sql
UPDATE slides SET slide_index = slide_index - 1
WHERE presentation_id = ?1 AND slide_index > ?2
```
This eliminates the N+1 SELECT+UPDATE pattern entirely.

#### 2.1b `update_slide_orders` — `src-tauri/src/db/queries/slides.rs:260–278`

Current: N individual UPDATEs (lines 265–269) + UPDATE presentations — no transaction.

Fix: Wrap in `conn.transaction()`. The per-row UPDATE loop is acceptable here (slide ordering requires individual index assignment), but it must be atomic.

#### 2.1c `save_sync_points` — `src-tauri/src/db/queries/music.rs:378–398`

Current: DELETE (line 383) + N INSERT statements (lines 390–396) — no transaction. A failed INSERT leaves the hymn with zero sync points.

Fix:
```rust
pub fn save_sync_points(conn: &Connection, hymn_id: i64, points: &[SyncPoint]) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM audio_sync_points WHERE hymn_id = ?1", params![hymn_id])?;
    let mut stmt = tx.prepare("INSERT INTO audio_sync_points (hymn_id, slide_index, timestamp_ms) VALUES (?1, ?2, ?3)")?;
    for point in points {
        stmt.execute(params![hymn_id, point.slide_index as i64, point.timestamp_ms as i64])?;
    }
    drop(stmt);
    tx.commit()?;
    Ok(())
}
```

---

### 2.2 `serve_media()` loads entire video file into RAM

**File:** `src-tauri/src/streaming/mod.rs:591`

**Problem:** `std::fs::read(&candidate)` at line 591 loads the complete file. A 500 MB video allocates 500 MB per concurrent request.

**Fix:** Stream in 64 KB chunks using `BufReader`:
```rust
let file = std::fs::File::open(&candidate)
    .map_err(|_| "Not Found")?;
let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
// Write HTTP headers with Content-Length: {file_len}
let mut reader = std::io::BufReader::new(file);
let mut buf = [0u8; 65_536];
loop {
    let n = reader.read(&mut buf)?;
    if n == 0 { break; }
    stream.write_all(&buf[..n])?;
}
stream.flush()?;
```

---

### 2.3 `estimate_mp3_duration_cbr` loads entire MP3 into RAM

**File:** `src-tauri/src/audio/player.rs:240–312`

**Problem:** `std::fs::read(path)` at line 241 loads the entire MP3 (potentially 50+ MB) just to read the ID3 header length and first MPEG frame header (first ~4 KB).

**Fix:** Use `BufReader` + read only what is needed, use `file.metadata().len()` for total size:
```rust
fn estimate_mp3_duration_cbr(path: &str) -> Option<u64> {
    use std::io::Read;
    let file = std::fs::File::open(path).ok()?;
    let file_len = file.metadata().ok()?.len() as usize;
    let mut reader = std::io::BufReader::new(file);
    let mut buf = vec![0u8; 4096.min(file_len)]; // read only first 4KB for header scan
    reader.read_exact(&mut buf).ok()?;
    // rest of ID3 parsing + frame header sync scan uses buf
    // bitrate math uses file_len instead of bytes.len()
    // ... (existing parse logic, unchanged except bytes → buf, bytes.len() → file_len)
}
```

---

### 2.4 TCP Accept Loop: Spin-sleep → Blocking with Timeout

**File:** `src-tauri/src/streaming/mod.rs:227–229`

**Problem:** Non-blocking socket + `thread::sleep(50ms)` on `WouldBlock` = 20 wakeups/second burning CPU, up to 50ms connection latency.

**Fix:** Switch to blocking accept with a short read timeout:
```rust
// In StreamingServer::start(), after TcpListener::bind():
listener.set_nonblocking(false).ok();
listener.set_read_timeout(Some(Duration::from_millis(100))).ok();

// In accept loop, replace the WouldBlock sleep arm:
Err(ref e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {
    continue; // No sleep needed — listener.accept() blocks for up to 100ms
}
```

---

## Group 3 — Quick Wins (low risk, small scope)

### 3.1 Remove `greet` dev scaffold

**Files:**
- `src-tauri/src/lib.rs:40–46` — delete the `fn greet()` function
- `src-tauri/src/lib.rs:142` — remove `greet,` from `generate_handler![]`
- `src/lib/tauri.ts:38–40` — delete the `export async function greet()` wrapper

---

### 3.2 Add `LIMIT` clause to `search_hymns`

**File:** `src-tauri/src/db/queries/music.rs:45, 63, 74`

**Problem:** All three query branches (empty, numeric, FTS) have no LIMIT. A single-character query or empty query can return thousands of rows, saturating the IPC bridge.

**Fix:** Add `LIMIT 200` to all three branches. Returning more than 200 results on a keypress search has no UX value.

---

### 3.3 Fix TypeScript type naming

**File:** `src/types/settings.ts:1`
- Rename `Settings` interface → `Setting`

**File:** `src/lib/tauri.ts:22` (import), `:398, :406`
- Update all references from `Settings` → `Setting`
- Update `getAllSettings(): Promise<Settings[]>` → `Promise<Setting[]>`

**File:** `src/types/migration.ts` — Create new file `src/types/updater.ts`, move `UpdateInfo` there
**File:** `src/lib/tauri.ts:22–24` — Update import from `../types/migration` → `../types/updater`

**Note:** Search for any other consumers of `Settings` (grep `types/settings`) before renaming to avoid missed references.

---

## Not in Scope (documented for future)

These items are confirmed improvements but are deferred — they require larger architectural changes:

- **`HymnSummary` slim type** — Requires new DB query, new TypeScript type, and updating all search consumers. Future task.
- **`SlideType` enum** — Requires updating models, all query mappers, commands, and frontend types. Future task.
- **SSE `Arc<str>` broadcast + `sync_channel`** — Low risk but touches streaming architecture. Future task.
- **WAL mode + `prepare_cached()`** — DB-wide change, low risk but needs testing. Future task.
- **`importBibleVersion` file-path IPC** — Requires frontend changes. Future task.
- **`AudioPlayer::play()` + `set_input_path()` unification** — The two-step API is intentional: `play()` receives the resolved absolute path, `set_input_path()` stores the original relative path for frontend identity matching. This is by design, not a bug.

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `src-tauri/src/state.rs` | Add `OverlayRuntimeState`, replace two bool fields |
| `src-tauri/src/lib.rs` | Update AppState init, remove `greet` fn + handler |
| `src-tauri/src/commands/display.rs` | Rewrite toggle_black/logo/get_overlay to use single `overlay` lock |
| `src-tauri/src/commands/utility.rs` | Spawn `copy_video_to_media`, `copy_image_to_media`; make `get_video_metadata` async |
| `src-tauri/src/db/queries/slides.rs` | Wrap `delete_slide` + `update_slide_orders` in transactions; simplify re-index SQL |
| `src-tauri/src/db/queries/music.rs` | Wrap `save_sync_points` in transaction; add LIMIT to `search_hymns` |
| `src-tauri/src/streaming/mod.rs` | Chunk `serve_media`; blocking accept with timeout |
| `src-tauri/src/audio/player.rs` | Fix `estimate_mp3_duration_cbr` to use BufReader |
| `src/lib/tauri.ts` | Remove `greet`; update `copyVideoToMedia` return type; rename Settings→Setting |
| `src/types/settings.ts` | Rename `Settings` → `Setting` |
| `src/types/updater.ts` | New file: move `UpdateInfo` from migration.ts |
| `src/types/migration.ts` | Remove `UpdateInfo` export |

---

## Verification

After implementation, verify each fix:

1. **Deadlock fix:** Simultaneously call `toggle_black_screen` and `toggle_logo_screen` from the browser console 100 times in a loop — confirm no hang.

2. **IPC blocking:** Call `copyVideoToMedia` with a large (1+ GB) video — confirm the IPC bridge remains responsive (other commands return immediately) and the `"video-copy-complete"` event fires after the copy finishes.

3. **ffprobe async:** Call `getVideoMetadata` with a file that triggers the ffprobe fallback — confirm other IPC calls are not blocked during the 4-second timeout window.

4. **DB transactions:** In `save_sync_points`, simulate an INSERT failure (e.g., constraint violation on the 2nd row) and confirm the DELETE is rolled back — sync points remain unchanged.

5. **serve_media chunking:** Request a large video file via the SSE streaming server URL and monitor RSS memory — confirm it stays flat (not spiking by the file size).

6. **CBR duration:** Play an MP3 file and confirm `duration_ms` is still correct after the `estimate_mp3_duration_cbr` fix.

7. **LIMIT clause:** Call `searchHymns("")` (empty query) and confirm the result array length is ≤ 200.

8. **Greet removal:** Confirm `cargo build` succeeds with `greet` removed, and no 404 errors for `"greet"` command in the frontend.

9. **TypeScript rename:** Run `npx tsc --noEmit` after renaming `Settings` → `Setting` and confirm zero type errors.

```bash
cargo build --manifest-path src-tauri/Cargo.toml
npx tsc --noEmit
```
