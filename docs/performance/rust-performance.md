# Rust Performance Best Practices for Tauri Apps (≤8GB RAM)

> Practical findings for the LouvorJA backend (Tauri 2, rusqlite, r2d2, rodio).
> Targets machines with 8GB RAM or less. All recommendations are actionable.

---

## Memory Management

### 1. Prefer References Over Clones
- Pass `&T` or `&str` instead of owned `T` or `String` wherever lifetimes allow.
- Profile first with DHAT (`dhat-rs`) to find hot allocation sites before optimizing.
- "Reducing allocation rates by 10 allocations per million instructions executed can have measurable performance improvements." — Rust Perf Book

### 2. Box / Rc / Arc Tradeoffs

| Type | When to use | Cost |
|------|-------------|------|
| `Box<T>` | Single-owner heap allocation; large structs to avoid stack copies | One heap alloc |
| `Rc<T>` | Shared ownership, **single-thread only** (AppState internals, UI state) | Ref count (not atomic) |
| `Arc<T>` | Shared ownership across threads (e.g., `AppState`, `content_dbs` pool) | Atomic ref count |
| `Arc<Mutex<T>>` | Shared **mutable** state across threads | Atomic + lock overhead |

Key rule: if a value is rarely shared but you still wrap it in `Rc`/`Arc`, you add heap allocation cost with no benefit. Prefer stack allocation for small structs.

### 3. Minimize Arc<Mutex<T>> Contention
`Arc<Mutex<T>>` is correct but scales poorly. Alternatives:
- **`RwLock<T>`** for read-heavy state (multiple readers can proceed concurrently). Use for `content_dbs`, `cancel_flags` maps, anything read often but written rarely.
- **Channels (`std::sync::mpsc`)** to eliminate shared state entirely between threads.
- **Finer-grained locks**: split a large locked struct into per-field locks so threads block each other less.
- **`Arc::make_mut()`**: for clone-on-write semantics — clones only when multiple references exist.

### 4. Collection Sizing

```rust
// Pre-allocate when size is known — prevents O(n) reallocations
let mut v: Vec<Hymn> = Vec::with_capacity(expected_count);

// Reuse collections in loops instead of allocating new ones
let mut buf = Vec::new();
for item in items {
    buf.clear(); // keeps capacity, avoids re-alloc
    process(&mut buf, item);
}
```

### 5. SmallVec / ArrayVec for Short Collections
- **`SmallVec<[T; N]>`** (crate `smallvec`): stores up to N elements on-stack; heap-fallback for overflow. Use when most collections have ≤8 items (e.g., stanzas per hymn, slides per service item). Slightly slower per-element due to branch; worth it only for hot paths with many small collections.
- **`ArrayVec<T, N>`** (crate `arrayvec`): no heap fallback at all. Use when you have a hard maximum (e.g., 2 monitors, 4 audio channels).
- **`HashMap` with small maps**: for <10 entries, a linear-scan `Vec<(K,V)>` or `SmallVec` often outperforms `HashMap` due to cache locality. Consider `indexmap` if you need insertion-order iteration.

### 6. String Optimization
- Avoid `format!()` for hot paths; use `write!(&mut string, ...)` on a pre-allocated `String`.
- `Cow<'_, str>` for functions that return borrowed data most of the time but occasionally need to own it.
- `smartstring` crate: drop-in `String` replacement that avoids heap allocation for strings ≤23 bytes (covers most DB column values like slugs, types, UUIDs).

### 7. Struct Layout
- Reorder fields from largest to smallest alignment to minimize padding (use `#[repr(C)]` only when FFI is needed).
- Keep hot fields at the top of the struct for cache-line efficiency.
- Use `Box<T>` for large infrequently-accessed sub-structs to keep the parent struct small.

---

## Database (rusqlite + r2d2)

### 1. Essential PRAGMA Settings
Run these on **every new connection** (in the r2d2 `CustomizeConnection` or in migrations init):

```sql
PRAGMA journal_mode = WAL;        -- enables concurrent readers; persistent
PRAGMA synchronous = NORMAL;      -- safe in WAL mode, ~2x faster than FULL
PRAGMA temp_store = MEMORY;       -- temp indices/tables in RAM, not disk
PRAGMA mmap_size = 134217728;     -- 128MB memory-mapped I/O (virtual, not RSS)
PRAGMA cache_size = -8000;        -- 8MB page cache per connection (negative = KiB)
PRAGMA foreign_keys = ON;         -- enforce FK constraints
PRAGMA optimize;                  -- update query planner stats (run before close too)
```

Corresponding Rust setup in `migrations.rs`:
```rust
conn.execute_batch("
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 134217728;
    PRAGMA cache_size = -8000;
    PRAGMA foreign_keys = ON;
")?;
```

Run `PRAGMA optimize;` again just before closing long-lived connections.

### 2. Prepared Statements
rusqlite's `Connection::prepare()` / `prepare_cached()` parses SQL once:

```rust
// Bad: re-parses SQL on every call
fn get_hymn(conn: &Connection, id: i64) -> Result<Hymn> {
    conn.query_row("SELECT ... FROM hymns WHERE id = ?1", [id], |r| ...)
}

// Good: use prepare_cached for frequently-called queries
fn get_hymn(conn: &Connection, id: i64) -> Result<Hymn> {
    let mut stmt = conn.prepare_cached("SELECT ... FROM hymns WHERE id = ?1")?;
    stmt.query_row([id], |r| ...)
}
```

`prepare_cached` stores the parsed statement in an LRU cache on the connection; ideal for repeated reads in request handlers.

### 3. Always Use Transactions for Multi-Row Writes
```rust
let tx = conn.transaction()?;
for item in batch {
    tx.execute("INSERT INTO ...", params![...])?;
}
tx.commit()?;
// Without this, SQLite auto-commits each row = 100x slower
```

### 4. r2d2 Pool Sizing for SQLite Desktop

SQLite allows **only one writer at a time** regardless of pool size. WAL mode allows concurrent readers.

Recommended configuration for a Tauri desktop app:
```rust
Pool::builder()
    .max_size(4)          // 4 connections: 1 write + 3 concurrent reads
    .min_idle(Some(1))    // keep 1 warm; avoid cold-start on first query
    .connection_timeout(Duration::from_secs(5))
    .idle_timeout(None)   // long-lived desktop app; don't close idle conns
    .max_lifetime(None)   // same: no need to recycle connections
    .build(manager)?;
```

Do not set `max_size > 8` — extra connections waste memory (each SQLite connection holds its own page cache) without enabling more parallelism for a desktop workload.

### 5. Index Usage
- Add indexes on columns used in WHERE, JOIN, and ORDER BY clauses.
- Use `EXPLAIN QUERY PLAN` in the SQLite CLI to verify index usage.
- Compound indexes beat multiple single-column indexes for multi-condition queries.
- Avoid `LIKE '%prefix%'` (no index); use FTS5 virtual tables for full-text search (already used in this codebase for hymn search).

### 6. content_dbs Memory Efficiency
When multiple content DBs are loaded (`pt-BR`, `es`, etc.), each pool connection holds a page cache. Cap per-connection cache:
- `PRAGMA cache_size = -4000;` (4MB) on content DB connections vs `-8000` for the primary app DB.
- Consider `min_idle(Some(0))` for language DBs not actively in use so connections are not kept warm.

---

## Async vs Sync Decisions

### Guiding Principle
> "Use async Rust only when you really need it." — corrode.dev

For a Tauri desktop app, **synchronous Rust + `std::thread::spawn` is the correct default.**

### Decision Table

| Scenario | Recommendation |
|----------|----------------|
| DB queries (rusqlite) | Sync — rusqlite is sync-only; wrapping in async adds overhead |
| Audio playback (rodio) | Sync — rodio is sync; run on dedicated background thread |
| HTTP requests (CDN sync, YouTube API) | Async (`reqwest` + `tokio`) — I/O-bound, benefits from async |
| File I/O (ZIP extraction, pack sync) | Sync + background thread — simpler, no runtime overhead |
| Long-running operations | `std::thread::spawn` + cancel flag — avoids blocking IPC |
| Window creation (Tauri) | `std::thread::spawn` — mandatory to not block IPC on Windows |

### Tokio Usage in This Project
Tauri 2 internally uses Tokio. For commands that need async (HTTP, YouTube API), use `#[tauri::command]` with `async fn` — Tauri's runtime handles it:

```rust
#[tauri::command]
pub async fn fetch_youtube_playlist(id: String) -> Result<Playlist, AppError> {
    // async HTTP call — correct use of async
    let data = reqwest::get(...).await?;
    Ok(data.json().await?)
}
```

For DB commands, **don't make them async**:
```rust
#[tauri::command]
pub fn get_hymn(id: i64, state: tauri::State<'_, AppState>) -> Result<Hymn, AppError> {
    let conn = state.db.get()?;
    db::queries::music::get_hymn_by_id(&conn, id)
    // No .await — sync is correct here
}
```

### Architecture Pattern
Keep domain logic synchronous. Use async only at I/O boundaries (network calls). Communicate results back via Tauri events (`app.emit()`) rather than blocking on async results.

---

## Serialization Optimization

### 1. Avoid Intermediate Allocations with serde_json
`serde_json` can parse directly into structs without building an intermediate `Value`:
```rust
// Bad: intermediate DOM allocation
let v: Value = serde_json::from_str(&json)?;
let hymn: Hymn = serde_json::from_value(v)?;

// Good: direct deserialization, zero intermediate allocation
let hymn: Hymn = serde_json::from_str(&json)?;
```

### 2. Use `&str` / `&[u8]` for Zero-Copy Deserialization
```rust
// String fields that are only read (not mutated after deserialization):
#[derive(Deserialize)]
struct HymnRef<'a> {
    title: &'a str,   // borrows from input buffer, no alloc
    slug: &'a str,
}
// vs. owned:
struct Hymn {
    title: String,    // allocates
}
```
Serde natively supports zero-copy deserialization for `&str` and `&[u8]` fields. Use this for read-only query parameters passed from the frontend.

### 3. Cow<'_, str> for Conditionally-Owned Fields
```rust
use std::borrow::Cow;

#[derive(Deserialize)]
struct SearchQuery<'a> {
    term: Cow<'a, str>,  // borrows if input is valid UTF-8; owns if needs escaping
}
```

### 4. serde_json::to_writer vs to_string
```rust
// Bad: allocates intermediate String
let json = serde_json::to_string(&data)?;
response.body(json);

// Better: write directly to a pre-allocated buffer
let mut buf = Vec::with_capacity(256);
serde_json::to_writer(&mut buf, &data)?;
```

### 5. Avoid Deriving Clone on Large Serialized Structs
If a struct is serialized and returned via IPC (Tauri command), it doesn't need to be `Clone` in the return path. Remove `#[derive(Clone)]` from response-only types to avoid accidental expensive clones.

### 6. `#[serde(skip_serializing_if = "Option::is_none")]`
On `SlideContent`'s many optional fields, this avoids serializing null keys to JSON, reducing payload size in IPC calls:
```rust
#[derive(Serialize)]
pub struct SlideContentFlat {
    pub slide_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lyrics: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_url: Option<String>,
    // ...
}
```

---

## Thread Management

### 1. Never Block the IPC Handler Thread
See existing CLAUDE.md warning. This is especially critical on Windows. Always return immediately from `#[tauri::command]` and spawn work:
```rust
#[tauri::command]
pub fn long_operation(app: AppHandle) -> Result<(), AppError> {
    std::thread::spawn(move || {
        // do work
        app.emit("operation-done", result).ok();
    });
    Ok(()) // returns immediately
}
```

### 2. Thread Pool for CPU-Bound Work (rayon)
For CPU-bound parallel work (e.g., batch ZIP extraction, image thumbnail generation), use `rayon` instead of spawning raw threads:

```rust
use rayon::prelude::*;

// Parallel processing of pack files — rayon manages thread pool automatically
files.par_iter().for_each(|file| {
    process_file(file);
});
```

Rayon's work-stealing scheduler outperforms manual `thread::spawn` for data-parallel tasks and automatically sizes the thread pool to available CPU cores.

Configure pool size to avoid memory pressure on low-spec machines:
```rust
rayon::ThreadPoolBuilder::new()
    .num_threads(2) // cap at 2 for background tasks on 4-core machines
    .build_global()?;
```

### 3. Reuse Threads via Channels Instead of Spawning Per-Task
```rust
// Bad: spawns a new OS thread for every operation
fn process_request(data: Data) {
    std::thread::spawn(move || handle(data));
}

// Good: send work to a persistent worker thread via channel
let (tx, rx) = std::sync::mpsc::channel::<Data>();
std::thread::spawn(move || {
    for data in rx { handle(data); } // thread lives for app lifetime
});
// Callers send to tx
```

This pattern (already used in audio init) avoids thread creation overhead and keeps the OS thread count bounded.

### 4. Cancellable Long-Running Operations
The existing `AtomicBool` cancel-flag pattern is correct and low-overhead:
```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

let cancel = Arc::new(AtomicBool::new(false));
let cancel_clone = cancel.clone();

std::thread::spawn(move || {
    for item in batch {
        if cancel_clone.load(Ordering::Relaxed) { break; }
        process(item);
    }
});
// cancel.store(true, Ordering::Relaxed) from main thread to stop
```

`Ordering::Relaxed` is sufficient for a simple boolean flag with no dependent ordering.

### 5. Audio Thread Pattern
rodio's `OutputStream` is neither Send nor Sync (WASAPI limitations). Keep it pinned to a dedicated thread that communicates via channels:
```rust
let (cmd_tx, cmd_rx) = mpsc::channel::<AudioCommand>();
std::thread::spawn(move || {
    let (_stream, handle) = OutputStream::try_default().unwrap();
    let sink = Sink::try_new(&handle).unwrap();
    for cmd in cmd_rx {
        match cmd {
            AudioCommand::Play(source) => sink.append(source),
            AudioCommand::Pause => sink.pause(),
            AudioCommand::Stop => sink.stop(),
        }
    }
});
```

---

## Image and Media Handling

### 1. Lazy Load Cover Images
Do not load all album/hymn covers into memory at startup. Use the existing `use-image-src.ts` hook which resolves paths on demand. On the Rust side, never pre-cache binary image data in memory — return file paths or HTTP URLs only.

### 2. Thumbnail Generation: Stream, Don't Buffer
When generating thumbnails (future feature), use streaming decoders:
```rust
// Read only the header to get dimensions; don't decode entire image
use image::io::Reader as ImageReader;
let reader = ImageReader::open(path)?.with_guessed_format()?;
let (w, h) = reader.into_dimensions()?; // reads minimal bytes
```

For full decode, process and drop immediately rather than caching in `AppState`.

### 3. Video File Serving: Range Requests
The existing video HTTP server with HTTP 206 range request support is the correct pattern. Never load video files into memory — let the OS page cache handle it via `mmap` or stream from disk.

### 4. Cover Image Path Resolution
Avoid resolving all image paths at DB query time. Return relative paths from DB queries; let the frontend resolve to URLs lazily via `useImageSrc` hook. This keeps DB responses small and avoids filesystem stat calls for off-screen items.

---

## Anti-Patterns to Avoid

### Memory
- **Cloning `Vec<Hymn>` to return from commands** — return `Vec<Hymn>` directly (move semantics), not `.clone()`.
- **`Arc<Mutex<Vec<T>>>` for read-only shared data** — use `Arc<RwLock<Vec<T>>>` or just `Arc<Vec<T>>` (immutable after init).
- **Storing image/audio binary data in `AppState`** — store paths only; load lazily per request.
- **`String::from` or `.to_string()` in hot DB loops** — use `&str` or `Cow<str>`.

### Database
- **Multiple individual INSERT statements outside a transaction** — wrap in `conn.transaction()`.
- **`query_row` with a freshly-parsed SQL string in every call** — use `prepare_cached`.
- **High pool `max_size` for SQLite** — wastes memory; SQLite serializes writes regardless.
- **Running `PRAGMA foreign_keys = ON` only in migrations** — must run on every connection (not persistent).
- **Missing indexes on FTS search fallback columns** — when FTS5 tables are absent, ensure `hymns.title` and `hymns.lyrics` have partial indexes.

### Async / Threading
- **Blocking in `#[tauri::command]` handlers** — always spawn; return immediately.
- **Using `tokio::task::spawn_blocking` for rusqlite** — correct in pure async contexts, but in Tauri commands just use sync commands; avoids double-threading.
- **Spawning an OS thread per DB query** — use the r2d2 pool instead; threads are expensive.
- **`std::thread::sleep()` in IPC handlers** — moves to a separate thread.

### Serialization
- **`serde_json::Value` as intermediate** — parse directly to typed structs.
- **`#[derive(Clone)]` on large IPC response types** — unnecessary; these are moved not cloned.
- **Serializing `None` optional fields** — use `#[serde(skip_serializing_if = "Option::is_none")]` to keep payloads lean.

---

## Profiling Workflow

### Setup (one-time)
```toml
# Cargo.toml
[profile.release]
debug = "line-tables-only"   # enables profiling without full debug info
```

```toml
# .cargo/config.toml
[build]
rustflags = ["-C", "force-frame-pointers=yes"]  # required by most profilers
```

### CPU Profiling (macOS)
```bash
# samply — best cross-platform option, Firefox Profiler UI
cargo install samply
samply record ./target/release/louvorja-multiplataform

# Instruments (macOS native, best for production profiling)
# Xcode → Instruments → Time Profiler → Attach to process
```

### Memory Profiling
```bash
# dhat-rs: add to Cargo.toml [dev-dependencies], instrument entry point
# heaptrack (Linux): tracks every heap alloc with call stacks
heaptrack ./target/release/louvorja-multiplataform

# cargo-bloat: find what's taking binary size
cargo install cargo-bloat
cargo bloat --release
```

### Flamegraph
```bash
cargo install flamegraph
cargo flamegraph --bin louvorja-multiplataform
# Opens flamegraph.svg — wide bars = hot code paths
```

### SQLite Query Analysis
```bash
sqlite3 ~/.local/share/louvorja/app.db
> EXPLAIN QUERY PLAN SELECT ...;
> .timer on
> SELECT ...;
```

---

## Quick Reference: Key Numbers

| Parameter | Recommended Value | Rationale |
|-----------|------------------|-----------|
| r2d2 `max_size` | 4 | SQLite single-writer; 3 readers + 1 writer |
| r2d2 `min_idle` | 1 (main DB), 0 (content DBs) | Keep main DB warm; lazy-init language DBs |
| `cache_size` PRAGMA (main DB) | `-8000` (8MB) | Covers typical hymnal workload |
| `cache_size` PRAGMA (content DBs) | `-4000` (4MB) | Lower; accessed less frequently |
| `mmap_size` PRAGMA | 134217728 (128MB) | Virtual memory, not RSS; safe on 8GB machines |
| rayon thread pool | 2 for background tasks | Leaves headroom for UI + audio threads |
| SmallVec inline size | 8 for slides, 4 for monitors | Covers typical values without heap |

---

## Sources

- [Heap Allocations — The Rust Performance Book](https://nnethercote.github.io/perf-book/heap-allocations.html)
- [Profiling — The Rust Performance Book](https://nnethercote.github.io/perf-book/profiling.html)
- [SQLite Performance Tuning — phiresky's blog](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- [SQLite Pragma Cheatsheet — Clément Joly](https://cj.rs/blog/sqlite-pragma-cheatsheet-for-performance-and-consistency/)
- [The State of Async Rust: Runtimes — corrode.dev](https://corrode.dev/blog/async/)
- [Bridging with sync code — Tokio docs](https://tokio.rs/tokio/topics/bridging)
- [Rust Memory Management 2025: Arc<Mutex<T>> Pitfalls — Markaicode](https://markaicode.com/rust-memory-management-2025/)
- [Memory Allocation Strategies: Box, Arc, Rc — Markaicode](https://markaicode.com/memory-allocation-strategies-box-arc-rc-2025/)
- [smallvec crate docs](https://docs.rs/smallvec/)
- [r2d2 crate — sfackler/r2d2](https://github.com/sfackler/r2d2)
- [r2d2-sqlite crate — gwenn/r2d2-sqlite](https://github.com/gwenn/r2d2-sqlite)
- [Serde zero-copy deserialization — StudyRaid](https://app.studyraid.com/en/read/10839/332206/zero-copy-deserialization)
- [Faster Rust Serialization — mo8it.com](https://mo8it.com/blog/faster-rust-serialization/)
- [How to Profile Rust with perf, flamegraph, samply — oneuptime.com](https://oneuptime.com/blog/post/2026-01-07-rust-profiling-perf-flamegraph/view)
- [Multiple Thread Pools in Rust — pkolaczk.github.io](https://pkolaczk.github.io/multiple-threadpools-rust/)
- [Solving Memory Bloat in Rust — Markaicode](https://markaicode.com/memory-optimization/)
- [Embedding SQLite in a Tauri Application — dezoito.github.io (2025)](https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html)
