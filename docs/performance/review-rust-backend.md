# Rust Backend Performance Review

> Audit date: 2026-03-29. Targets machines with ≤8GB RAM.
> Reference: `docs/performance/tauri-performance.md`, `docs/performance/rust-performance.md`.
> **This is analysis only — no code was modified.**

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 4     |
| Medium   | 5     |
| Low      | 3     |
| **Total**| **12**|

---

## Findings

---

### [SEVERITY: High] Missing critical SQLite PRAGMAs on main DB and bible DB connections

**File:** `src-tauri/src/db/mod.rs:12–13`, `src-tauri/src/db/mod.rs:61–62`

**Issue:** Both `init_db()` and `init_bible_db()` only set `journal_mode=WAL`, `foreign_keys=ON`, and `busy_timeout=5000`. Three critical per-connection PRAGMAs are absent: `synchronous = NORMAL`, `temp_store = MEMORY`, and `mmap_size = 134217728`. Without `synchronous = NORMAL`, SQLite defaults to `FULL` mode which forces an extra fsync per transaction, causing ~2× slower write performance. Without `temp_store = MEMORY`, temporary sort/index tables spill to disk on every query with ORDER BY or GROUP BY. Without `mmap_size`, the OS cannot memory-map the DB file for read acceleration. `cache_size` is also not set (default is a tiny 2MB).

**Current code:**
```rust
// init_db  (identical block in init_bible_db)
c.execute_batch(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
)
```

**Suggested fix:**
```rust
c.execute_batch(
    "PRAGMA journal_mode = WAL;
     PRAGMA synchronous = NORMAL;
     PRAGMA temp_store = MEMORY;
     PRAGMA mmap_size = 134217728;
     PRAGMA cache_size = -8000;
     PRAGMA foreign_keys = ON;
     PRAGMA busy_timeout = 5000;",
)
```

**Impact:** `synchronous = NORMAL` alone typically halves write latency on spinning disks and reduces SSD wear amplification. `temp_store = MEMORY` eliminates disk I/O for sort/temp operations in search and list queries. `cache_size = -8000` (8MB) raises the page cache from the 2MB default, reducing repeated I/O on hymn lists. Combined effect: noticeable UI responsiveness improvement on low-spec machines (HDD or slow SSD).

---

### [SEVERITY: High] Missing critical PRAGMAs on content DB connections (`open_content_db_pool`)

**File:** `src-tauri/src/db/queries/content_sync.rs:741–747`

**Issue:** `open_content_db_pool()` builds the r2d2 pool with no `with_init` customizer. The only PRAGMAs applied to content DB connections are `journal_mode=WAL` and `cache_size=-8000` inside `init_content_db_fts()` — but `init_content_db_fts` is only called once at startup for FTS setup, not on every new connection acquired from the pool. When the pool creates additional connections (up to `max_size(3)`), those connections get zero PRAGMAs. Missing: `synchronous = NORMAL`, `temp_store = MEMORY`, `mmap_size`, `busy_timeout`, `foreign_keys`. The consequence is that connections 2 and 3 from the pool operate with SQLite defaults (2MB cache, fsync-heavy writes, no mmap).

**Current code:**
```rust
pub fn open_content_db_pool(path: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    let manager = SqliteConnectionManager::file(path);
    Pool::builder()
        .min_idle(Some(1))
        .max_size(3)
        .build(manager)
        .map_err(|e| AppError::Internal(format!("Content DB pool error: {}", e)))
}
```

**Suggested fix:**
```rust
pub fn open_content_db_pool(path: &Path) -> Result<Pool<SqliteConnectionManager>, AppError> {
    let manager = SqliteConnectionManager::file(path).with_init(|c| {
        c.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA temp_store = MEMORY;
             PRAGMA mmap_size = 134217728;
             PRAGMA cache_size = -4000;
             PRAGMA busy_timeout = 5000;",
        )
        .map_err(Into::into)
    });
    Pool::builder()
        .min_idle(Some(0))
        .max_size(3)
        .build(manager)
        .map_err(|e| AppError::Internal(format!("Content DB pool error: {}", e)))
}
```

Note: `cache_size = -4000` (4MB) per the reference docs recommendation for content DBs accessed less frequently. Also changed `min_idle` from `Some(1)` to `Some(0)` — the reference docs recommend keeping content DB connections lazy (`min_idle = 0`) to avoid holding warm connections for languages not actively in use.

**Impact:** Per-language content DB can serve multiple users of the pool with correct performance settings. `min_idle(0)` frees one connection's worth of memory (including its 4MB page cache) when a language is not actively queried. On a system with 3 content languages loaded, this saves ~12MB of RSS from idle page caches.

[⚠️ RISK] `init_content_db_fts()` currently also sets `journal_mode=WAL` and `cache_size=-8000` inline. If `with_init` is added, the values in `init_content_db_fts` become redundant but harmless (they are idempotent). No behavior change, but the inline PRAGMAs in `init_content_db_fts` should be noted as duplicates after this fix.

---

### [SEVERITY: High] `r2d2` pool uses default `max_size` (unbounded) for main and bible DB

**File:** `src-tauri/src/db/mod.rs:17`, `src-tauri/src/db/mod.rs:67`

**Issue:** Both `init_db()` and `init_bible_db()` call `Pool::new(manager)` which uses the r2d2 default `max_size` of **10**. SQLite has a single-writer constraint, so 10 connections provide no parallelism benefit for writes. Each idle connection holds its own page cache (with the default 2MB cache = up to 20MB just for idle main-DB connections). On ≤8GB machines, this is wasteful. The reference docs recommend `max_size(4)` for the primary DB and a proportional setting for the bible DB (read-only, no writes needed beyond import).

**Current code:**
```rust
// init_db
let pool = Pool::new(manager).map_err(|e| AppError::Internal(e.to_string()))?;

// init_bible_db
let pool = Pool::new(manager).map_err(|e| AppError::Internal(e.to_string()))?;
```

**Suggested fix:**
```rust
// init_db — main app DB
let pool = Pool::builder()
    .max_size(4)
    .min_idle(Some(1))
    .connection_timeout(std::time::Duration::from_secs(5))
    .build(manager)
    .map_err(|e| AppError::Internal(e.to_string()))?;

// init_bible_db — read-only in normal operation
let pool = Pool::builder()
    .max_size(2)
    .min_idle(Some(1))
    .connection_timeout(std::time::Duration::from_secs(5))
    .build(manager)
    .map_err(|e| AppError::Internal(e.to_string()))?;
```

**Impact:** Reduces maximum idle connection count from 10+10=20 to 4+2=6. At 2MB default cache per connection that's up to 28MB RSS saved (40MB vs 12MB). With the PRAGMA fix applied (8MB cache each), the saving grows to ~112MB vs 48MB at max pool saturation.

---

### [SEVERITY: High] Missing `[profile.release]` in `Cargo.toml` — binary not optimized for size or LTO

**File:** `src-tauri/Cargo.toml` (no `[profile.release]` section found)

**Issue:** There is no `[profile.release]` table in `Cargo.toml`. Rust's default release profile uses `opt-level = 3` (optimize for speed, not size), `lto = false` (no link-time optimization), `codegen-units = 16` (fast compile, poor LLVM optimization), `strip = false` (debug symbols included in binary), and `panic = unwind` (unwinding tables in binary). For a Tauri desktop app on ≤8GB systems, this results in: a significantly larger binary (slower startup), more memory mapped at runtime, and more RSS from loaded code pages. The reference docs show a 20–30% binary size reduction from `strip = true` alone, and further savings from `lto = true` + `codegen-units = 1`.

**Current code:** *(section absent)*

**Suggested fix:**
```toml
[profile.release]
opt-level     = "z"      # minimize size; use "3" only if profiling shows CPU bottleneck
lto           = true     # cross-crate inlining + dead code elimination
codegen-units = 1        # single LLVM module; best optimization
panic         = "abort"  # removes unwinding tables (~100KB savings)
strip         = true     # removes debug symbols (20–30% binary size reduction)
```

**Impact:** Typical Tauri app sees 20–40% binary size reduction. Smaller binary = faster cold start (less code to page into memory), reduced RSS from memory-mapped code segments. `panic = "abort"` is safe for this app since panics are not caught (the app is designed to crash and restart on panic).

[⚠️ RISK] `opt-level = "z"` optimizes for size over speed. For CPU-bound code paths (ZIP extraction, FTS tokenization), performance may regress slightly vs `"3"`. If profiling reveals bottlenecks in those paths, change to `opt-level = "s"` (balanced). `panic = "abort"` changes panic behavior — but the app already uses `AppError` returns everywhere and does not catch panics, so this is safe.

---

### [SEVERITY: Medium] `content_dbs: Arc<Mutex<...>>` should be `Arc<RwLock<...>>` — read-heavy state under exclusive lock

**File:** `src-tauri/src/state.rs:209`, `src-tauri/src/lib.rs:324–325`

**Issue:** `content_dbs` is typed as `Arc<Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>`. This map is written only during startup scan and after pack sync (rare), but read on every hymn search, collection fetch, and music lookup that touches content DBs. `Mutex` serializes all readers — only one thread can read `content_dbs` at a time even when two separate commands are just looking up the pool for different languages simultaneously. An `Arc<RwLock<...>>` allows concurrent readers to proceed without blocking each other.

**Current code:**
```rust
// state.rs
pub content_dbs: Arc<Mutex<HashMap<String, Pool<SqliteConnectionManager>>>>,

// lib.rs
content_dbs: std::sync::Arc::new(std::sync::Mutex::new(
    std::collections::HashMap::new(),
)),
```

**Suggested fix:**
```rust
// state.rs
pub content_dbs: Arc<RwLock<HashMap<String, Pool<SqliteConnectionManager>>>>,

// lib.rs
content_dbs: std::sync::Arc::new(std::sync::RwLock::new(
    std::collections::HashMap::new(),
)),
```

All call sites using `.lock().unwrap()` must be updated to `.read().unwrap()` (for reads) or `.write().unwrap()` (for inserts at startup/sync).

**Impact:** Eliminates false contention between concurrent search commands on different languages. Measurable improvement when two windows are open and each performs a hymn search simultaneously (e.g., main window + spotlight). On ≤8GB systems with fewer CPU cores, lock contention shows up earlier.

[⚠️ RISK] All call sites must be audited and updated from `.lock()` to `.read()` or `.write()` as appropriate. Missing a write site and leaving it as `.read()` would cause a compile error (RwLockReadGuard is not mutable), so the compiler catches all cases. No silent correctness risk.

---

### [SEVERITY: Medium] `setup()` blocks on DB migration, bible DB copy, content DB scan, streaming auto-start, and global shortcut registration

**File:** `src-tauri/src/lib.rs:295–476` (the entire `setup` closure)

**Issue:** The `setup()` hook is synchronous and runs on the main thread. All work inside it — DB migrations, bible.db copy, content-*.db pool initialization loop, streaming server auto-start, and global shortcut DB queries — runs synchronously before the app event loop starts. Per the reference docs, any blocking call in `setup()` stalls all `invoke()` calls, making the app appear frozen. The streaming `server.start(port)` call in particular binds a TCP socket synchronously. The content DB scan uses `std::fs::read_dir` synchronously inside a loop. While migrations and DB copies are fast on most systems, they can take several seconds on HDD systems or slow NAS storage.

**Current code (excerpt):**
```rust
.setup(move |app| {
    // ...
    let pool = db::init_db(&app_data_dir)  // synchronous, runs migrations
        .map_err(|e| format!("Failed to initialize database: {e}"))?;
    // bible.db copy (synchronous fs ops)
    // content-*.db scan loop (synchronous)
    // streaming server start (synchronous TCP bind)
    // global shortcut registration (synchronous DB queries)
    Ok(())
})
```

**Suggested fix:**
```rust
.setup(move |app| {
    let handle = app.handle().clone();
    // Only absolutely-required sync init here (pool creation, manage() calls)
    let pool = db::init_db(&app_data_dir)?;
    app.manage(AppState { db: pool, ... });

    // Spawn everything else
    tauri::async_runtime::spawn(async move {
        // bible.db copy, content-*.db scan, streaming auto-start, shortcut registration
        handle.emit("app-ready", ()).ok();
    });
    Ok(())
})
```

**Impact:** Reduces the time-to-first-render and time-to-first-responsive-IPC, which is most visible on HDD systems or slow hardware. Eliminates the scenario where the app appears frozen for 1–3 seconds while `setup()` runs migration and scans content DBs.

[⚠️ RISK] Moving `app.manage()` calls after the spawn would cause commands to fail before initialization completes. The `manage()` calls must stay synchronous before any spawn. Commands that need content DBs must handle the case where the pool is not yet registered (already handled by `content_dbs.lock().unwrap().get(lang)` returning `None`). The streaming auto-start must use `tauri::async_runtime::spawn` rather than `tokio::spawn` directly (per CLAUDE.md pattern).

---

### [SEVERITY: Medium] `plan_pack_sync` uses `tokio::task::block_in_place` in async context — wrong concurrency pattern for DB work

**File:** `src-tauri/src/commands/pack_sync.rs:35–54`

**Issue:** `plan_pack_sync` is `pub async fn` and uses `tokio::task::block_in_place()` to call synchronous DB operations. `block_in_place` is intended for single-threaded Tokio runtimes and "blocks the current thread" — it works in `new_multi_thread` but prevents Tokio from scheduling other tasks on that thread while the block runs. The reference docs state: "For DB commands, don't make them async. Use sync fn — rusqlite is sync-only; wrapping in async adds overhead." This command does a sync DB read and a potentially slow HTTP manifest fetch. The HTTP fetch is the only legitimately async part; the DB reads should be in a sync command or use `spawn_blocking`.

**Current code:**
```rust
pub async fn plan_pack_sync(...) -> Result<PackSyncPlan, AppError> {
    let conn = tokio::task::block_in_place(|| {
        state.db.get().map_err(...)
    })?;
    let stored_version = tokio::task::block_in_place(|| {
        crate::db::queries::settings::get_setting(&conn, ...)...
    });
    // ... HTTP fetch ...
}
```

**Suggested fix:** Split into two phases: a sync pre-check (DB reads), then if a network fetch is needed, use `reqwest` async naturally inside the async fn. The `block_in_place` wrappers around trivially fast operations (pool.get + one DB read) add overhead without benefit.

```rust
pub async fn plan_pack_sync(...) -> Result<PackSyncPlan, AppError> {
    // DB reads are fast — get conn and stored_version without block_in_place
    let conn = state.db.get().map_err(|e| AppError::Internal(e.to_string()))?;
    let stored_version = crate::db::queries::settings::get_setting(&conn, "pack_sync.manifest_version")
        .ok()
        .and_then(|s| s.value.parse::<i64>().ok())
        .unwrap_or(0);
    // ... rest of async HTTP logic unchanged ...
}
```

**Impact:** Removes unnecessary `block_in_place` overhead on every sync plan call. Simplifies the code. The r2d2 `pool.get()` call is already non-blocking in a multi-thread context.

[⚠️ RISK] Low. `pool.get()` can block waiting for a free connection if all connections are checked out. With `max_size(4)` this is extremely unlikely for a single-call plan command. The existing `block_in_place` did protect against this; removing it means a long-running connection checkout would block the Tokio thread instead of the physical thread. Accept this trade-off or use `spawn_blocking` for the entire DB section.

---

### [SEVERITY: Medium] `search_hymns` / `search_all_hymns` use `conn.prepare()` not `conn.prepare_cached()`

**File:** `src-tauri/src/db/queries/music/music_app.rs:60–104`, `110–158`

**Issue:** All three branches of both `search_hymns` and `search_all_hymns` (empty query, numeric prefix, FTS5) call `conn.prepare(...)` which re-parses the SQL string on every invocation. These are the hottest read paths in the app — called on every keystroke in hymn search (debounced but still frequent). `conn.prepare_cached()` stores the parsed statement in an LRU cache on the connection and reuses it on subsequent calls with zero re-parse overhead.

**Current code (representative):**
```rust
// search_hymns — empty query branch
let mut stmt = conn.prepare(
    "SELECT h.id, h.number, ... FROM hymns h WHERE h.category = 'hymnal' ORDER BY h.number, h.title"
)?;

// get_hymn_by_id
conn.query_row(
    "SELECT id, number, ... FROM hymns WHERE id = ?1",
    params![id],
    map_hymn_row,
)
```

**Suggested fix:**
```rust
// Use prepare_cached for all frequently-called queries
let mut stmt = conn.prepare_cached(
    "SELECT h.id, h.number, ... FROM hymns h WHERE h.category = 'hymnal' ORDER BY h.number, h.title"
)?;
```

For `get_hymn_by_id` specifically, since `query_row` does not have a `prepare_cached` shorthand, use:
```rust
let mut stmt = conn.prepare_cached(
    "SELECT id, number, ... FROM hymns WHERE id = ?1"
)?;
stmt.query_row(params![id], map_hymn_row).map_err(|e| ...)
```

**Impact:** Eliminates SQL parsing overhead on every search keystroke. Measurable on slow hardware — SQLite parser for a 200-character SELECT costs ~5–15µs per call; across 10 keystrokes/second that's 50–150µs/sec of pure overhead eliminated. Also reduces allocator pressure (no temporary parse tree allocation).

---

### [SEVERITY: Medium] `identify_monitors` is `async fn` but does only synchronous window operations

**File:** `src-tauri/src/commands/display.rs:656`

**Issue:** `identify_monitors` is declared `pub async fn` but its body uses `catcher(app.available_monitors())`, `WebviewWindowBuilder::new()`, and a `std::thread::spawn(move || { std::thread::sleep(...); win.close(); })` — all synchronous Tauri calls. The function is `async` purely to satisfy some convention, but it doesn't `.await` any futures. Making sync commands `async` forces Tauri to dispatch them through the Tokio thread pool instead of handling them inline, adding unnecessary scheduling overhead for what is a fast operation.

**Current code:**
```rust
#[tauri::command]
#[specta::specta]
pub async fn identify_monitors(app: AppHandle) -> Result<(), AppError> {
    let (monitors, err) = catcher(app.available_monitors());
    // ... all sync operations ...
}
```

**Suggested fix:**
```rust
#[tauri::command]
#[specta::specta]
pub fn identify_monitors(app: AppHandle) -> Result<(), AppError> {
    let (monitors, err) = catcher(app.available_monitors());
    // ... unchanged body ...
}
```

**Impact:** Minor scheduling overhead elimination. More importantly, establishes the correct pattern: async only for I/O-bound operations (network, large file reads). Low but measurable on the initial monitor identification during app startup.

---

### [SEVERITY: Low] `tokio` feature set could be more minimal

**File:** `src-tauri/Cargo.toml:57`

**Issue:** `tokio = { version = "1", features = ["rt-multi-thread", "macros"] }` is already reasonably minimal — it does not use `"full"`. However, the `"macros"` feature is only needed if this crate directly uses `#[tokio::main]` or `tokio::select!`. Since Tauri manages the runtime, `"macros"` may be unused dead weight. The reference docs flag `"full"` as a 10–20MB binary inflation source; this project avoids that but can be trimmed further.

**Current code:**
```toml
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

**Suggested fix:**
```toml
tokio = { version = "1", features = ["rt-multi-thread", "time", "sync"] }
```

**Impact:** Minor — likely saves a few hundred KB in binary size. Low priority compared to other findings. Confirm `"macros"` is unused in the codebase before removing.

[⚠️ RISK] If `tokio::select!`, `#[tokio::test]`, or `tokio::join!` are used anywhere (check with `grep -r "tokio::select\|tokio::join\|#\[tokio::test\]"` in `src-tauri/src/`), the `"macros"` feature is required. Removing it without verifying will cause a compile error.

---

### [SEVERITY: Low] `open_content_db_pool` sets `min_idle(Some(1))` for all language DBs — keeps connections warm unnecessarily

**File:** `src-tauri/src/db/queries/content_sync.rs:743`

**Issue:** `min_idle(Some(1))` keeps at least one connection warm per loaded language DB. If 3 languages are loaded (`pt-BR`, `es`, `en`), r2d2 maintains 3 warm connections even when no hymn lookup is active. Each warm connection holds its own SQLite page cache. On systems with limited RAM and multiple languages installed, this creates background memory pressure. The reference docs explicitly recommend `min_idle(Some(0))` for content DBs.

**Current code:**
```rust
Pool::builder()
    .min_idle(Some(1))
    .max_size(3)
    .build(manager)
```

**Suggested fix:**
```rust
Pool::builder()
    .min_idle(Some(0))
    .max_size(3)
    .build(manager)
```

**Impact:** With 3 languages and 4MB cache per connection, saves up to 12MB RSS when the app is idle (no active search). Connections are created on demand (first lookup after idle takes one pool-checkout latency ~<1ms).

---

### [SEVERITY: Low] `serde_json::to_vec` without capacity hint used in `save_manifest_cache`

**File:** `src-tauri/src/commands/pack_sync.rs:27`

**Issue:** `serde_json::to_vec(manifest)` allocates a `Vec<u8>` starting at a small default capacity and grows dynamically during serialization of the manifest (which can be large — it contains all pack metadata for all languages). This causes multiple heap reallocations. A pre-allocated buffer via `serde_json::to_writer` into a `Vec::with_capacity(estimated)` avoids this.

**Current code:**
```rust
fn save_manifest_cache(app: &AppHandle, manifest: &ContentManifest) {
    if let Ok(path) = manifest_cache_path(app) {
        if let Ok(json) = serde_json::to_vec(manifest) {
            let _ = std::fs::write(path, json);
        }
    }
}
```

**Suggested fix:**
```rust
fn save_manifest_cache(app: &AppHandle, manifest: &ContentManifest) {
    if let Ok(path) = manifest_cache_path(app) {
        let mut buf = Vec::with_capacity(4096);
        if serde_json::to_writer(&mut buf, manifest).is_ok() {
            let _ = std::fs::write(path, buf);
        }
    }
}
```

**Impact:** Minor allocator pressure reduction. The manifest cache is written infrequently (once per sync session), so this is low-priority. Mainly relevant if the manifest grows large (>50KB).

---

## Quick-Win Priority Order

1. **Apply missing PRAGMAs** (Findings 1 + 2) — highest bang-for-buck; 2 lines of code change each, immediate query performance improvement.
2. **Cap r2d2 pool max_size** (Finding 3) — 3 lines of code change, reduces RSS up to ~100MB at pool saturation.
3. **Add `[profile.release]`** (Finding 4) — 6 lines in Cargo.toml, 20–40% binary size reduction.
4. **`Arc<RwLock>` for content_dbs** (Finding 5) — straightforward type change + call-site audit.
5. Remaining findings (Medium/Low) — address incrementally.
