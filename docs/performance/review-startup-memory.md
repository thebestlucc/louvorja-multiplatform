# Startup & Memory Performance Review

**Date:** 2026-03-29
**Scope:** Tauri setup(), Zustand stores, root layout, image-src hook
**Target:** Machines with ≤8GB RAM

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 5     |
| Medium   | 8     |
| Low      | 4     |
| **Total**| **17**|

---

## High Severity

---

### [SEVERITY: High] Audio device init blocks setup() synchronously — can hang IPC on Windows

**File:** `src-tauri/src/state.rs:231-235` + `src-tauri/src/audio/player.rs:167-199`

**Issue:** `AudioState::default()` calls `AudioPlayer::new()` which calls `OutputStream::try_default()` (rodio / WASAPI) inline. This is synchronous and runs on the setup() call-chain. On Windows with a missing or misbehaving audio device the WASAPI enumeration loop can block indefinitely. `setup()` is synchronous; blocking it stalls the entire event loop and makes all `invoke()` calls hang forever with no error.

The `try_open_output_stream` fallback already iterates all devices, which adds additional enumeration latency even in the normal path.

**Current code:**
```rust
// state.rs
impl Default for AudioState {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self::disabled())
    }
}

// player.rs
pub fn new() -> Result<Self, AppError> {
    let (stream, stream_handle) = Self::try_open_output_stream()  // <-- blocks here
        .map_err(|e| AppError::Internal(...))?;
    ...
}

// lib.rs — setup() calls this via app.manage(AudioState::default())
app.manage(AudioState::default());
```

**Suggested fix:**
Move audio init to a background thread with a timeout. Return a `disabled()` state immediately, then swap in the real player once it's ready:
```rust
// In setup():
app.manage(AudioState::disabled()); // non-blocking immediate return
let handle = app.handle().clone();
std::thread::spawn(move || {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        tx.send(AudioPlayer::new()).ok();
    });
    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(Ok(player)) => {
            let state = handle.state::<AudioState>();
            *state.player.write().unwrap() = player;
        }
        _ => eprintln!("[audio] init timed out or failed — staying disabled"),
    }
});
```

**Impact:** Eliminates potential infinite hang on Windows with driver issues. Reduces startup latency by 50–500ms on machines with multiple audio devices.

[⚠️ RISK] Audio commands issued within the first ~5 seconds of startup will get `AudioPlayer::disabled()` errors. These are already handled gracefully (disabled player returns `Err`). The risk is that a user presses play immediately after launch and gets an error toast — accept this in exchange for IPC reliability.

---

### [SEVERITY: High] r2d2 pools use `Pool::new()` with no configuration — default max_size=10 wastes RAM

**File:** `src-tauri/src/db/mod.rs:17` and `src-tauri/src/db/mod.rs:67`

**Issue:** Both `init_db()` and `init_bible_db()` use `Pool::new(manager)` which defaults to `max_size=10`. SQLite has a single-writer constraint — 10 connections do not enable any parallelism, they just burn RAM. Each SQLite connection holds its own page cache (default ~2MB each), so 10 connections = ~20MB of unreachable page cache for a database that only ever has 1 active query at a time.

**Current code:**
```rust
// db/mod.rs
let pool = Pool::new(manager).map_err(...)?; // max_size defaults to 10
```

**Suggested fix:**
```rust
let pool = Pool::builder()
    .max_size(4)
    .min_idle(Some(1))
    .connection_timeout(std::time::Duration::from_secs(5))
    .build(manager)
    .map_err(...)?;
```

**Impact:** ~12MB RSS saved per DB (main + bible = ~24MB total at startup). The `cache_size` PRAGMA is also missing from both pools (currently not set at all) — adding `PRAGMA cache_size = -8000` on the main DB and `-4000` on bible would cap page caches instead of letting them grow unbounded.

---

### [SEVERITY: High] content_dbs pool holds `min_idle=1` connection per language DB — unbounded RSS with many languages

**File:** `src-tauri/src/db/queries/content_sync.rs:742-746`

**Issue:** `open_content_db_pool` sets `min_idle(Some(1))` and `max_size(3)`. With 3 language DBs installed (e.g. pt-BR, es, en), that is 3 warm connections always held open (3 × ~4MB page cache + connection overhead). If more language packs are added later, this scales linearly. The Rust performance guide recommends `min_idle(Some(0))` for content DBs since they are accessed infrequently.

**Current code:**
```rust
Pool::builder()
    .min_idle(Some(1))  // keeps 1 connection warm per language DB
    .max_size(3)
    .build(manager)
```

**Suggested fix:**
```rust
Pool::builder()
    .min_idle(Some(0))  // lazy: only open connections when actually queried
    .max_size(2)        // 1 writer + 1 reader is sufficient for content DBs
    .connection_timeout(std::time::Duration::from_secs(5))
    .build(manager)
```

Also add a `with_init` customizer to set `PRAGMA cache_size = -4000` on content DB connections (currently missing).

**Impact:** ~4–12MB RSS saved per installed language pack (freed when connections close). On a 3-language install this saves ~12MB at idle.

---

### [SEVERITY: High] `usePresentationStore()` called with no selector — full store subscription

**File:** `src/routes/services/$serviceId.tsx:70-76`

**Issue:** `usePresentationStore()` with no selector subscribes to the **entire store**. The `ServiceEditor` component will re-render on any `presentationStore` change, including `currentVideoProjectionId`, `slides`, `activeSlideIndex` — none of which are used in this component. `ServiceEditor` is the main service editing surface and this creates unnecessary cascading re-renders during projection events.

**Current code:**
```ts
const {
  setActiveService,
  isPlayingService,
  activeServiceItemIndex,
  setPlayingService,
  setActiveServiceItemIndex,
} = usePresentationStore(); // no selector — subscribes to entire store
```

**Suggested fix:**
```ts
import { useShallow } from 'zustand/react/shallow';

const {
  setActiveService,
  isPlayingService,
  activeServiceItemIndex,
  setPlayingService,
  setActiveServiceItemIndex,
} = usePresentationStore(
  useShallow((s) => ({
    setActiveService: s.setActiveService,
    isPlayingService: s.isPlayingService,
    activeServiceItemIndex: s.activeServiceItemIndex,
    setPlayingService: s.setPlayingService,
    setActiveServiceItemIndex: s.setActiveServiceItemIndex,
  }))
);
```

**Impact:** Eliminates re-renders of `ServiceEditor` on `slides`, `currentVideoProjectionId`, `activeSlideIndex` changes (all of which are frequent during projection). Service list items will stop flickering during active playback.

[⚠️ RISK] None — selecting the exact same fields, just not subscribing to unrelated ones.

---

### [SEVERITY: High] `useQueueStore()` called with no selector in `PlayingQueue`

**File:** `src/components/playing-now/playing-queue.tsx:60`

**Issue:** `useQueueStore()` with no selector subscribes to the entire queue store including `manualQueue`, `sourceQueue`, `shuffle`, `repeat`, and all action functions. `PlayingQueue` only uses `items`, `currentIndex`, `setCurrentIndex`, `removeFromQueue`. This component is mounted on the Playing Now screen which is active during music playback — it will re-render on any queue store change.

**Current code:**
```ts
const { items, currentIndex, setCurrentIndex, removeFromQueue } = useQueueStore();
```

**Suggested fix:**
```ts
import { useShallow } from 'zustand/react/shallow';

const { items, currentIndex, setCurrentIndex, removeFromQueue } = useQueueStore(
  useShallow((s) => ({
    items: s.items,
    currentIndex: s.currentIndex,
    setCurrentIndex: s.setCurrentIndex,
    removeFromQueue: s.removeFromQueue,
  }))
);
```

**Impact:** Eliminates re-renders of the queue list on shuffle/repeat mode changes and on changes to `manualQueue`/`sourceQueue` that don't change the derived `items` array.

[⚠️ RISK] None.

---

## Medium Severity

---

### [SEVERITY: Medium] `useMonitors` and `useMonitorConfigs` have no `staleTime` — refetch on every mount

**File:** `src/lib/queries/music.ts:89-94` + `src/lib/queries/display.ts:16-21`

**Issue:** Both `useMonitors()` and `useMonitorConfigs()` have no `staleTime` (defaults to `0`). These queries are called from `__root.tsx` which is mounted for the entire app lifetime. However, they are also likely called in monitor settings panels. With `staleTime: 0`, every route navigation that mounts a component calling these hooks triggers a fresh IPC call to enumerate monitors — a syscall that is unnecessary since monitor topology changes are already handled via the `monitors-changed` event + `queryClient.invalidateQueries`.

**Current code:**
```ts
export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors.all,
    queryFn: () => getAvailableMonitors(), // no staleTime
  });
}
```

**Suggested fix:**
```ts
export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors.all,
    queryFn: () => getAvailableMonitors(),
    staleTime: Infinity, // invalidated by monitors-changed event in __root.tsx
  });
}
// Same for useMonitorConfigs
```

**Impact:** Eliminates redundant monitor enumeration IPC calls on every navigation. Monitors change rarely; event-driven invalidation in `__root.tsx` already handles actual changes.

---

### [SEVERITY: Medium] `useAlbums`, `useBibleVersions`, `useBooks` have no `staleTime` — static data refetched on every mount

**File:** `src/lib/queries/music.ts:50-55`, `src/lib/queries/bible.ts:12-17`, `src/lib/queries/bible.ts:19-26`

**Issue:** Albums, Bible versions, and Bible books are effectively static during a session (they change only after a pack sync). All three queries have no `staleTime`, so they refetch on every component mount. In the Bible route, switching between chapters remounts `useBooks` with the same `versionId` and triggers a fresh IPC call every time.

**Current code:**
```ts
export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(), // no staleTime
  });
}
```

**Suggested fix:**
```ts
export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
    staleTime: Infinity,    // never changes mid-session
    gcTime: Infinity,       // keep in cache for the whole session
  });
}
// Same for useBibleVersions (staleTime: Infinity)
// Same for useBooks — staleTime: Infinity, gcTime: 60_000 (66 books max)
```

**Impact:** Eliminates ~3–10 redundant IPC calls on each Bible/Hymnal navigation. Reduces SQLite query pressure during rapid chapter-switching.

---

### [SEVERITY: Medium] `useAllHymns` has no `staleTime` — global spotlight search refetches on every keystroke mount

**File:** `src/lib/queries/music.ts:28-33`

**Issue:** `useAllHymns` has no `staleTime` (defaults to 0). It is used by the command palette / spotlight global search. Each time the spotlight opens, a fresh IPC call is fired immediately on mount, even if the hymn catalog hasn't changed since the last open.

**Current code:**
```ts
export function useAllHymns(query: string) {
  return useQuery({
    queryKey: ["hymns", "search-all", query],
    queryFn: () => searchAllHymns(query),
    // no staleTime
  });
}
```

**Suggested fix:**
```ts
export function useAllHymns(query: string) {
  return useQuery({
    queryKey: ["hymns", "search-all", query],
    queryFn: () => searchAllHymns(query),
    staleTime: 60_000, // 1 min: hymn catalog stable; invalidated by data-changed event
  });
}
```

**Impact:** Spotlight reopens instantly from cache on second open within 1 minute; eliminates one IPC call per spotlight open.

---

### [SEVERITY: Medium] `useHymnAudioPath` has no `staleTime` — audio file path refetched on every mount

**File:** `src/lib/queries/music.ts:35-39`

**Issue:** Audio file paths never change during a session (the file is on disk and its path in the DB is immutable unless re-synced). With no `staleTime`, each time the hymn detail page mounts it fires a fresh IPC call to retrieve the audio path, adding latency before playback can start.

**Current code:**
```ts
export function useHymnAudioPath(hymnId: number) {
  return useQuery({
    queryKey: queryKeys.hymns.audioPath(hymnId),
    queryFn: () => getHymnAudioPath(hymnId),
    // no staleTime
  });
}
```

**Suggested fix:**
```ts
export function useHymnAudioPath(hymnId: number) {
  return useQuery({
    queryKey: queryKeys.hymns.audioPath(hymnId),
    queryFn: () => getHymnAudioPath(hymnId),
    staleTime: Infinity,       // path doesn't change mid-session
    gcTime: 30 * 60_000,       // 30 min: keep warm for recently viewed hymns
  });
}
```

**Impact:** Eliminates one IPC call per hymn detail mount; audio playback start is snappier on second visit to same hymn.

---

### [SEVERITY: Medium] `data-changed` event in `__root.tsx` triggers a broad invalidation of all hymn queries

**File:** `src/routes/__root.tsx:113-123`

**Issue:** The `data-changed` event listener invalidates `queryKeys.hymns.all`, `queryKeys.albums.all`, and `queryKeys.collections.all()`. `queryKeys.hymns.all` is a root key — depending on how `queryKeys.hymns` is structured, this may invalidate hymn search results for all queries including the `search(query)` variants, causing all currently mounted hymn search components to refetch simultaneously.

**Current code:**
```ts
listen("data-changed", () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
})
```

**Suggested fix:** Confirm that `queryKeys.hymns.all` does not match search-result sub-keys. If it does, target invalidation more narrowly using `exact: true` or use separate top-level keys for search vs. list.

**Impact:** Without this check, a single pack sync completion could trigger a cascade of 10+ simultaneous IPC calls from all mounted hymn search components, causing a memory spike and UI jank.

[⚠️ RISK] Narrowing invalidation too aggressively could cause stale search results after a sync. Verify `queryKeys` structure before changing.

---

### [SEVERITY: Medium] `useThemeStore` subscribed twice in `__root.tsx` — double re-render on theme change

**File:** `src/routes/__root.tsx:60,66`

**Issue:** `__root.tsx` calls `useThemeStore` twice: once for `setLanguage` (line 60) and once for `state.theme` (line 66, without using the return value). The second call subscribes to the store for `theme` but discards the value — its only effect is to trigger a re-render of `RootLayout` on every theme change so the CSS re-evaluates. This is an unusual pattern that creates two store subscriptions in the same component.

**Current code:**
```ts
const setLanguage = useThemeStore((state) => state.setLanguage);
// ... many lines later ...
useThemeStore((state) => state.theme); // return value unused
```

**Suggested fix:** Combine into a single selector:
```ts
const { setLanguage } = useThemeStore(
  useShallow((s) => ({ setLanguage: s.setLanguage }))
);
// Theme changes propagate via CSS attribute on <html> set inside applyTheme()
// — the subscription for re-render purposes is already handled by applyTheme().
// Remove the unused `useThemeStore((state) => state.theme)` line entirely.
```

**Impact:** Eliminates one redundant re-render of the entire root layout on every theme change.

[⚠️ RISK] Verify that `applyTheme()` correctly updates the CSS attribute; if React component tree re-render is genuinely needed to propagate theme tokens then this subscription must stay.

---

### [SEVERITY: Medium] Spotlight window kept alive (WebView) for the entire session

**File:** `src-tauri/src/lib.rs:388-404`

**Issue:** The spotlight window is pre-created at startup and kept as a hidden WebView for the entire app session. Per the Tauri performance guide, each hidden WebView holds its JS engine, DOM, and layout cache (~15–30MB). A known Tauri issue (#14088) also documents that windows hidden for 50+ minutes can disappear on some platforms. The spotlight window is a small, self-contained UI that can be recreated cheaply on demand.

**Current code:**
```rust
// setup()
if let Err(e) = commands::spotlight::create_spotlight_window(app.handle()) {
    eprintln!("[spotlight] Failed to pre-create spotlight window: {e}");
}
// Then immediately force-hide it after 300ms via a spawned thread
```

**Suggested fix:** Create the spotlight window on first invocation of `spotlight_open` rather than at startup. Pre-creating it to avoid Space switching (macOS) can be solved differently (e.g., creating it on the first render cycle but keeping it invisible and never destroying it after the first show, only hiding it).

If pre-creation is required for the macOS Space constraint, the existing pattern is acceptable but document it as a known ~20MB memory cost.

**Impact:** ~15–25MB RSS savings at startup if spotlight is rarely used. Eliminates the 300ms sleep thread at startup.

[⚠️ RISK] macOS: spotlight must live on the current Space. If closed and recreated, it may appear on a different Space. The current forced-hide pattern is specifically designed to work around this. Only change if you verify macOS Space behavior is acceptable.

---

### [SEVERITY: Medium] Main DB and Bible DB pools missing `cache_size`, `temp_store`, `synchronous` PRAGMAs

**File:** `src-tauri/src/db/mod.rs:11-13` and `src-tauri/src/db/mod.rs:60-63`

**Issue:** Both `init_db` and `init_bible_db` only set `journal_mode=WAL`, `foreign_keys=ON`, and `busy_timeout=5000`. They are missing performance-critical PRAGMAs documented in both reference documents:
- `PRAGMA synchronous = NORMAL` — removes most fsync overhead (safe with WAL)
- `PRAGMA temp_store = MEMORY` — keeps temp tables in RAM, not disk
- `PRAGMA cache_size = -8000` — sets 8MB page cache per connection (default is 2MB)
- `PRAGMA mmap_size = 134217728` — 128MB virtual memory-mapped I/O

**Current code:**
```rust
c.execute_batch(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
)
```

**Suggested fix:**
```rust
c.execute_batch(
    "PRAGMA journal_mode=WAL;
     PRAGMA synchronous=NORMAL;
     PRAGMA temp_store=MEMORY;
     PRAGMA mmap_size=134217728;
     PRAGMA cache_size=-8000;
     PRAGMA foreign_keys=ON;
     PRAGMA busy_timeout=5000;",
)
```

**Impact:** Measurable query latency reduction for the hymn list (frequent reads). `synchronous=NORMAL` alone gives ~2x write throughput improvement. `cache_size` prevents excessive I/O during repeated reads of the same hymn pages.

---

## Low Severity

---

### [SEVERITY: Low] `useImageSrc` resolves `join()` IPC call on every path even for `media/` prefix paths

**File:** `src/hooks/use-image-src.ts:84-98`

**Issue:** `appDataDirCache` correctly caches the `appDataDir()` IPC call. However, the `join()` call at line 63 and 88 is also an IPC call (`@tauri-apps/api/path`'s `join` invokes Tauri IPC to normalize paths on the Rust side). For CDN-relative and `media/` paths, `join` is called on every `useImageSrc` mount for a new path, adding an extra IPC round-trip per image.

**Current code:**
```ts
const appDir = await getCachedAppDataDir();
return await join(appDir, normalized.slice(1)); // IPC call
```

**Suggested fix:** Use pure JS string concatenation for simple path joining since `appDataDir` already returns an absolute path and the relative part contains no `..` components:
```ts
const appDir = await getCachedAppDataDir();
const sep = appDir.endsWith("/") || appDir.endsWith("\\") ? "" : "/";
return `${appDir}${sep}${normalized.slice(1)}`; // no IPC needed
```

**Impact:** Eliminates 1 IPC call per image mount that resolves a CDN or `media/` path. In a virtualized list of 50 hymn cards, this saves ~50 IPC round-trips on first render.

[⚠️ RISK] Path separator handling differs on Windows (`\`) vs macOS/Linux (`/`). The `appDataDir()` result uses the OS separator. Test on Windows before removing `join()`. Alternatively, use `appDir.replace(/\\/g, '/') + '/' + path` for cross-platform safety.

---

### [SEVERITY: Low] `VideoPlayerStore` module-level `subscribe` never unsubscribes — accumulates across HMR reloads

**File:** `src/stores/video-player-store.ts:61-105`

**Issue:** The `useVideoPlayerStore.subscribe(...)` call at module level (line 61) runs once when the module is first imported and is never cleaned up. In production this is fine since the module is never re-imported. However, during development with HMR (hot module reload), each reload re-executes the module, adding another subscriber without removing the previous one. Over a development session this accumulates and causes duplicate `broadcast_video_state_to_streaming` IPC calls per state change.

Also, `_streamingThrottleTimer` is module-level state that is NOT reset across HMR reloads, potentially causing the throttle to be stuck.

**Current code:**
```ts
// module level — no cleanup handle
useVideoPlayerStore.subscribe((state, prev) => {
  // ...
});
```

**Suggested fix:** Export the unsubscribe function so it can be re-called on HMR hot dispose. In Vite:
```ts
const unsubscribeStreamingSync = useVideoPlayerStore.subscribe(...);

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeStreamingSync();
    if (_streamingThrottleTimer) clearTimeout(_streamingThrottleTimer);
  });
}
```

**Impact:** No production impact. Prevents dev-mode memory accumulation and duplicate IPC calls during development, reducing debugging confusion.

---

### [SEVERITY: Low] No Tokio thread-pool cap — default spawns `num_cpus` threads at startup

**File:** `src-tauri/src/lib.rs` (before `tauri::Builder::default()`)

**Issue:** Tauri's `async_runtime` starts Tokio with default settings, which spawns `num_cpus` worker threads. On a 4-core machine this creates 4 threads × ~8MB stack = ~32MB RSS just for the async runtime, before the app does anything. On ≤8GB machines, this is unnecessary for a desktop app that does very little concurrent async work.

**Current code:**
```rust
// No custom runtime — Tauri uses its default (num_cpus threads)
pub fn run() {
    let specta_builder = ...;
    let mut builder = tauri::Builder::default();
```

**Suggested fix:**
```rust
pub fn run() {
    // Cap Tokio thread pool for low-memory systems
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");
    tauri::async_runtime::set(rt.handle().clone());

    let specta_builder = ...;
```

**Impact:** Saves ~16MB RSS on a 4-core machine (from 4 threads to 2). The app's async workload (YouTube API, pack sync HTTP) does not require more than 2 async threads.

[⚠️ RISK] If concurrent async tasks are ever CPU-bound and require more parallelism (e.g., parallel pack downloads), 2 threads may serialize them. Given the current workload (mostly I/O-bound HTTP), 2 is sufficient. Profile before reducing further.

---

### [SEVERITY: Low] Streaming server started synchronously in setup() with mutex lock held

**File:** `src-tauri/src/lib.rs:406-440`

**Issue:** The auto-start streaming server block in `setup()` acquires `streaming.server.lock()` and calls `server.start(Some(port))` synchronously. `start()` likely binds a TCP socket and spawns threads. While this is generally fast, it holds `setup()` longer than necessary. The streaming server is not needed before first paint.

**Current code:**
```rust
if auto_start {
    let streaming = app.state::<StreamingState>();
    let server_result = streaming.server.lock();
    if let Ok(mut server) = server_result {
        // ...
        if let Err(e) = server.start(Some(port)) { ... }
    }
}
```

**Suggested fix:** Defer streaming server auto-start to a spawned thread that runs after `setup()` returns:
```rust
if auto_start {
    let handle = app.handle().clone();
    let language = language.clone();
    let app_data = app_data_dir.clone();
    std::thread::spawn(move || {
        let streaming = handle.state::<StreamingState>();
        if let Ok(mut server) = streaming.server.lock() {
            server.set_ui_language(&language);
            server.set_media_root(app_data);
            if let Err(e) = server.start(Some(port)) {
                eprintln!("[streaming] Failed to auto-start: {e}");
            }
        }
    });
}
```

**Impact:** Reduces time-to-first-paint by however long TCP socket binding takes (~5–50ms). Keeps setup() minimal.

[⚠️ RISK] Streaming server will not be available for the first ~100ms after launch. Since it is used by external browsers (OBS, etc.) this is acceptable — those clients reconnect. The frontend `getStreamingStatus` poll handles the race.

---

## Notes for Future Sessions

1. **React Compiler** — once enabled (via `babel-plugin-react-compiler`), findings #4 and #5 (full store selections) may self-resolve if the compiler can optimize the destructuring. Still prefer explicit selectors as a safety net.

2. **Virtual scrolling** — `HymnSearch` already uses `@tanstack/react-virtual`. Check `AlbumCard` grid and Bible search results if item counts grow beyond 200.

3. **`PRAGMA optimize`** — consider running it at app shutdown (`on_window_event` → `CloseRequested` for main window) to update query planner statistics for the next session.

4. **Content DB `cache_size`** — the `open_content_db_pool` function does not set any PRAGMAs on connections. Adding a `with_init` customizer with `PRAGMA cache_size = -4000; PRAGMA temp_store = MEMORY;` would cap memory usage per language DB.
