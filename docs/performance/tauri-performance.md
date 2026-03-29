# Tauri 2 Performance Best Practices (≤8GB RAM)

Research date: 2026-03-29. Sources cited inline. Applies to Tauri 2.x with rusqlite/r2d2, React 19, Vite 7.

---

## IPC & Command Patterns

### Use async commands for all non-trivial work
Sync commands without `async` run on the main thread and block the entire IPC bridge.
Always declare heavy handlers `async` or annotate with `#[tauri::command(async)]`.

```rust
#[tauri::command]
async fn heavy_query(state: tauri::State<'_, AppState>) -> Result<Vec<Row>, AppError> {
    // runs on Tokio thread pool, never blocks IPC main thread
}
```

### Use `tauri::ipc::Response` for large payloads (avoid JSON)
All standard return values are JSON-serialized. For files, images, or byte arrays >10KB, return `tauri::ipc::Response` (raw bytes) instead. JSON serialization of large data is the single biggest IPC overhead.

```rust
use tauri::ipc::Response;

#[tauri::command]
fn get_cover_image(path: String) -> Response {
    let bytes = std::fs::read(path).unwrap_or_default();
    Response::new(bytes)
}
```

### Use Channels for streaming / progress (not repeated `invoke` calls)
`tauri::ipc::Channel` is the official mechanism for streamed data (file chunks, download progress, sync progress). Polling with repeated `invoke()` creates a new IPC round-trip per call.

```rust
#[tauri::command]
async fn stream_file(path: String, channel: tauri::ipc::Channel<Vec<u8>>) {
    // send 4096-byte chunks via channel.send()
}
```

### Use Events for fire-and-forget state changes, Commands for request/response
Events: one-way, untyped, no return value — ideal for lifecycle/state notifications (`slide-changed`, `overlay-changed`).
Commands: typed, bidirectional, supports errors — use for all data-returning calls.
Do not use repeated event polling as a substitute for a Channel.

### Benchmark reality: IPC is not free
Non-scientific community benchmark for 10MB binary transfer:
- macOS: ~5ms
- Windows: ~200ms (fetch-API overhead in WebView2)

Keep individual IPC payloads small. Batch DB reads on the Rust side before returning; never page-loop from the frontend.

### Isolation Pattern adds encryption overhead — use only if required
The Isolation IPC pattern encrypts all messages (AES-GCM). Most apps should use the default Brownfield pattern unless threat-modeling demands it.

---

## Memory Management

### Set `WebViewExtWindows::set_memory_usage_level(Low)` for hidden windows (Windows only)
When a window goes background/inactive, call `set_memory_usage_level(Low)` via the `wry` Windows extension. This was added in wry 0.35 and "can significantly reduce memory consumption" on Windows.

```rust
use wry::WebViewExtWindows;
webview.set_memory_usage_level(wry::MemoryUsageLevel::Low);
// restore to Normal when window becomes active again
```

### Destroy projector/return windows when not in use rather than hiding them
A hidden WebView still holds its JS engine, DOM, and layout cache. If a window will be unused for >5 minutes, close and recreate it. Use `WebviewWindowBuilder` with `visible(false)` to pre-build cheaply, then show on demand.

Known issue (Tauri #14088): keeping windows hidden for extended periods (50+ min) can cause the WebView page to disappear on some platforms. Prefer close/recreate over long-lived hidden windows.

### Avoid multiple WebView instances for shared content
Each WebView has its own JS engine overhead (~15–30MB). Use a single window with route-based navigation where possible. For projection, one window per screen is fine; avoid spawning preview/thumbnail windows that duplicate the main webview.

### Prevent JS memory leaks from Tauri event listeners
`listen()` returns an unlisten function. Always call it on component unmount. Orphaned listeners keep the event system alive and accumulate closure references.

```ts
useEffect(() => {
    const unlisten = listen("slide-changed", handler);
    return () => { unlisten.then(fn => fn()); };
}, []);
```

### Cap the Tokio thread pool for low-memory systems
By default `tauri::async_runtime` spawns Tokio with a full thread pool. On ≤8GB systems each thread costs ~8MB stack. Override the runtime before `tauri::Builder`:

```rust
fn main() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)  // vs default (num_cpus)
        .enable_all()
        .build()
        .unwrap();
    tauri::async_runtime::set(rt.handle().clone());
    tauri::Builder::default()...run(...)
}
```

### Prefer stack allocation and `Vec::with_capacity` in hot paths
Reduce allocator pressure in query result builders. Use `rows.size_hint()` or known row counts to pre-size Vecs. Avoid cloning strings unnecessarily — use `&str` in sync handlers, `String` in async ones (required by Tauri's async borrow rules).

---

## Startup Optimization

### `setup()` cannot be async — spawn heavy init work immediately
The Tauri `setup()` hook is synchronous. Any blocking call (audio device init, DB migration, CDN manifest fetch) will stall the event loop and make all `invoke()` calls appear permanently pending.

Pattern: spawn via `tauri::async_runtime::spawn`, return `Ok(())` immediately.

```rust
.setup(|app| {
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        // DB migrations, audio init, manifest cache load...
        handle.emit("app-ready", ()).ok();
    });
    Ok(())
})
```

Use `tauri::async_runtime::spawn` (not raw `tokio::spawn`) — direct tokio spawns can silently fail inside Tauri's setup context.

### Use `mpsc::channel` + `recv_timeout` for init tasks that can fail/hang
Wrap anything that might block forever (audio device enumeration, network calls) with a timeout channel so startup never hangs:

```rust
let (tx, rx) = std::sync::mpsc::channel();
std::thread::spawn(move || {
    let result = risky_init();
    tx.send(result).ok();
});
match rx.recv_timeout(std::time::Duration::from_secs(5)) {
    Ok(v) => { /* use v */ }
    Err(_) => { /* fallback, log warning */ }
}
```

### Build windows hidden, show after content is ready
Set `visible: false` in window config, emit an event from the frontend's `onMount`/`useEffect`, then call `window.show()` from Rust. This eliminates the blank-white-flash on startup.

```json
// tauri.conf.json
"windows": [{ "visible": false, ... }]
```

### Defer non-critical plugin initialization
Register plugins in order of criticality. Plugins that are not needed at first paint (autostart, updater, clipboard) can be initialized after the `app-ready` event rather than in `setup()`.

### Enable `removeUnusedCommands` (Tauri 2.4+)
```json
{ "build": { "removeUnusedCommands": true } }
```
Strips all commands not listed in ACL capability files from the binary. Reduces binary size and startup parse time. Only works if your capability files are not over-permissive.

---

## SQLite / r2d2 Patterns

### Pool size: 1 writer + small reader pool (max 4–5 total)
SQLite has a **single writer** constraint. Multiple writer connections do not parallelize — they serialize with lock contention. On ≤8GB RAM:

```rust
// writer pool — always max_size(1)
let writer_pool = Pool::builder()
    .max_size(1)
    .build(SqliteConnectionManager::file(&db_path))?;

// reader pool — WAL allows concurrent reads
let reader_pool = Pool::builder()
    .max_size(4)
    .connection_timeout(std::time::Duration::from_secs(30))
    .build(SqliteConnectionManager::file(&db_path))?;
```

Or use a single pool of max 5 if the app is single-writer by design (one pool, one write at a time via a `Mutex<()>` write guard).

### Apply these PRAGMAs on every new connection
These are connection-level; must be set in the `connection_customizer` or on first acquisition:

```rust
conn.execute_batch("
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 134217728;   -- 128MB, safe on 8GB systems
    PRAGMA cache_size = -16000;     -- 16MB page cache (negative = kibibytes)
    PRAGMA busy_timeout = 5000;     -- 5s wait on locked DB instead of SQLITE_BUSY
    PRAGMA foreign_keys = ON;
")?;
```

Notes:
- `synchronous = NORMAL` is safe with WAL and removes most fsync overhead.
- `mmap_size` is virtual memory (not physical) — OS manages physical pages. 128MB is safe on 8GB.
- `cache_size = -16000` limits the page cache to 16MB per connection. Default is 2MB; too low causes excessive I/O.
- `busy_timeout` prevents `SQLITE_BUSY` errors when two connections contend.

### Add indexes for all queried columns; use `EXPLAIN QUERY PLAN`
Full-table scans on hymns/slides tables create memory pressure. Index FTS tables separately (FTS5 has its own index). Check query plans during development:

```sql
EXPLAIN QUERY PLAN SELECT * FROM hymns WHERE title LIKE ?;
```

### Use WAL checkpoint control to prevent unbounded WAL growth
Long read transactions prevent WAL checkpointing, causing the WAL file to grow. Run manual checkpoints periodically or after bulk writes:

```rust
conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
```

### Avoid `SELECT *` on wide tables; select only needed columns
Each extra column in a result set increases deserialization work and heap allocation. Hymn rows with audio path, cover path, lyrics, etc. should only fetch the fields the view needs.

---

## Frontend Bundle & Asset Performance

### Code-split by route with dynamic imports
React 19 + Vite: lazy-load heavy routes (editor, projector, online-videos). The main chunk should contain only the shell and the hymn list.

```ts
const PresentationEditor = lazy(() => import('./routes/presentations/$presentationId'));
```

### Optimize images: WebP/AVIF, never embed large PNGs in the bundle
Cover images from the CDN should be served from the filesystem via the asset protocol or video HTTP server, not inlined as base64. Use `<img loading="lazy">` for lists.

### Vite build config for Tauri production builds
```ts
// vite.config.ts
build: {
    target: 'esnext',        // no polyfills needed in controlled webview
    minify: 'esbuild',
    rollupOptions: {
        output: {
            manualChunks: {
                vendor: ['react', 'react-dom'],
                router: ['@tanstack/react-router'],
                query: ['@tanstack/react-query'],
            }
        }
    }
}
```

### Cargo release profile for small + fast binary
```toml
[profile.release]
opt-level   = "z"      # minimize size (use "3" if CPU-bound perf matters more)
lto         = true     # link-time optimization
codegen-units = 1      # better LLVM optimization
panic       = "abort"  # removes unwinding tables
strip       = true     # remove debug symbols (20–30% additional size reduction)
```

### Only enable needed Tokio features
```toml
# Bad — pulls in everything
tokio = { features = ["full"] }

# Good — only what Tauri actually needs
tokio = { features = ["rt-multi-thread", "time", "sync", "io-util"] }
```
Using `"full"` can inflate the binary by 10–20MB.

### Use `React.memo`, `useMemo`, `useCallback` aggressively in list components
HymnCard and AlbumCard rendered in virtual lists should be memoized. A scroll through 3000 hymns triggering 3000 re-renders each time will consume significant memory in the WebView JS heap.

### Virtual scrolling for lists > 100 items
Use `@tanstack/react-virtual` (already in the ecosystem) for the hymn list and slide thumbnail list. Rendering 500+ DOM nodes inflates WebView memory by 50–200MB.

---

## Anti-Patterns to Avoid

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| Blocking `setup()` with heavy init | Hangs all `invoke()` calls; app appears frozen | Spawn via `tauri::async_runtime::spawn`, return immediately |
| `tokio = { features = ["full"] }` | 10–20MB binary bloat, more threads = more RSS | Use minimal features |
| Returning large Vec/String as JSON | JSON serialization is CPU+memory expensive | Use `tauri::ipc::Response` for bytes |
| Polling with `setInterval` + `invoke` | N IPC round-trips/sec, competes with render | Use Tauri events or `Channel` |
| Keeping all windows alive hidden | WebView holds JS engine, DOM, layout cache even hidden | Close and recreate, or use `set_memory_usage_level(Low)` on Windows |
| `SELECT *` from wide DB tables | Allocates all columns, most unused | Select only needed columns |
| `r2d2` pool `max_size > 5` with SQLite | SQLite single-writer serializes anyway; extra connections waste RAM | max 1 writer + 4 readers |
| `opt-level = "3"` in release for binary size | Larger binary, longer startup parse | Use `"z"` unless profiling shows CPU bottleneck |
| Not calling `unlisten()` on component unmount | Listener accumulation, event system memory leak | Always return unlisten from `useEffect` |
| Spawning a projector window on the IPC thread | `sleep()` in handler blocks all IPC on Windows | Always `std::thread::spawn` window ops |
| Sending 10k-item datasets as single IPC response | 500MB+ memory spikes during serialization | Paginate or stream via Channel |
| Creating multiple WebViews for thumbnails/previews | Each WebView: ~15–30MB overhead | Use CSS/canvas rendering in existing window |
| Not using `busy_timeout` PRAGMA | `SQLITE_BUSY` errors on concurrent access | Set `PRAGMA busy_timeout = 5000` |

---

## Sources

- [Calling Rust from the Frontend — Tauri v2 docs](https://v2.tauri.app/develop/calling-rust/)
- [Inter-Process Communication — Tauri v2 docs](https://v2.tauri.app/concept/inter-process-communication/)
- [App Size — Tauri v2 docs](https://v2.tauri.app/concept/size/)
- [wry 0.35.0 release notes (set_memory_usage_level)](https://v2.tauri.app/release/wry/v0.35.0/)
- [tauri::async_runtime — Rust docs](https://docs.rs/tauri/latest/tauri/async_runtime/index.html)
- [Tauri v2 Performance and Bundle Size Optimization Guide — Oflight Inc.](https://www.oflight.co.jp/en/columns/tauri-v2-performance-bundle-size)
- [Performance: Tauri IPC vs React Native JSI — GitHub Discussion #11915](https://github.com/tauri-apps/tauri/discussions/11915)
- [Tauri + Rust: Speed, But Here's Where It Breaks Under Pressure — Medium](https://medium.com/@srish5945/tauri-rust-speed-but-heres-where-it-breaks-under-pressure-fef3e8e2dcb3)
- [Building Tauri Apps That Don't Hog Memory at Idle — Medium](https://medium.com/@hadiyolworld007/building-tauri-apps-that-dont-hog-memory-at-idle-de516dabb938)
- [SQLite Performance Tuning — phiresky's blog](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- [How to extract builder setup function and make it async — Tauri Discussion #7596](https://github.com/tauri-apps/tauri/discussions/7596)
- [Application crashes after all windows are hidden — Tauri Issue #14088](https://github.com/tauri-apps/tauri/issues/14088)
- [IPC Improvements — Tauri Discussion #5690](https://github.com/tauri-apps/tauri/discussions/5690)
- [r2d2-sqlite — crates.io](https://crates.io/crates/r2d2-sqlite/)
- [Long-running backend async tasks in Tauri v2 — sneaky crow](https://sneakycrow.dev/blog/2024-05-12-running-async-tasks-in-tauri-v2)
