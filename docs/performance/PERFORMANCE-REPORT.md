# LouvorJA Performance Report
**Target:** Machines with ≤8GB RAM
**Date:** 2026-03-29
**Total findings:** 59 (18 High · 26 Medium · 15 Low)

---

## Detailed Reports
- [Rust Backend](./review-rust-backend.md) — 12 findings (4H/5M/3L)
- [React Queries & Hooks](./review-react-queries.md) — 15 findings (5H/6M/4L)
- [IPC & Events](./review-ipc-events.md) — 15 findings (4H/7M/4L)
- [Startup & Memory](./review-startup-memory.md) — 17 findings (5H/8M/4L)

---

## 🔴 HIGH Priority (18) — Fix First

### 1. Audio init blocks IPC on Windows — CRASH RISK
**File:** `src-tauri/src/lib.rs` (setup)
`AudioState::default()` calls `OutputStream::try_default()` synchronously. Bad audio driver = IPC hangs forever.
**Fix:** spawn audio init on background thread with `mpsc::recv_timeout(5s)`, return `disabled()` on timeout.
**Impact:** Prevents complete app freeze on Windows with no audio device.

### 2. SQLite missing 4 of 7 performance PRAGMAs
**File:** `src-tauri/src/db/migrations.rs`
Only `WAL`, `foreign_keys`, `busy_timeout` set. Missing: `synchronous=NORMAL`, `temp_store=MEMORY`, `mmap_size=134217728`, `cache_size=-16000`.
Also: `open_content_db_pool` has NO `with_init` at all — connections 2-3 get zero PRAGMAs.
**Fix:** Add all 7 PRAGMAs to `with_init` on every pool builder.
**Impact:** 2–5× DB throughput improvement.

### 3. r2d2 pool default max_size=10 wastes ~24MB RAM
**File:** `src-tauri/src/lib.rs`
Both main and bible DBs use `Pool::new()` defaults → up to 20 idle connections holding page caches.
**Fix:** `.max_size(4)` on both pools. SQLite serializes writes anyway; >4 connections provide no benefit.
**Impact:** ~24MB RSS reduction at idle.

### 4. content_dbs min_idle=1 holds 3×4MB per language at idle
**File:** `src-tauri/src/lib.rs` (open_content_db_pool)
With 3 language DBs loaded: ~12MB held permanently.
**Fix:** `.min_idle(0)` on content DB pools.
**Impact:** ~12MB RSS reduction when content DBs idle.

### 5. No `[profile.release]` in Cargo.toml — 20-40% binary/RSS waste
**File:** `src-tauri/Cargo.toml`
Ships with `lto=false`, `codegen-units=16`, debug symbols included.
**Fix:**
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
panic = "abort"
```
**Impact:** 20–40% binary size reduction; smaller binary → less resident memory.

### 6. N+1 IPC in `handleProjectCollection` — up to 10s on Windows
**File:** `src/routes/collections/index.tsx` (handleProjectCollection)
`for...of` with `await` per hymn: 50 hymns = 50 serial IPC round-trips.
**Fix:** Convert to `Promise.all([...hymns.map(h => getSlides(h.id))])` or add a `get_slides_batch` Rust command.
⚠️ **RISK:** `Promise.all` fails-fast on first error; wrap each in `catcher()` before batching.
**Impact:** 50× latency reduction for collection projection.

### 7. `useIsFavorite` fires 1 IPC per visible list item — 500 calls on mount
**File:** `src/lib/queries/services.ts` (useIsFavorite)
Each `FavoriteButton` in a hymn grid calls its own IPC query.
**Fix:** Add `get_all_favorite_ids(itemType)` Rust command → returns `Set<number>` → single query shared via `useQuery`.
⚠️ **RISK:** Requires new Rust command + migration of `FavoriteButton` to consume Set lookup.
**Impact:** 500→1 IPC calls on hymn list mount.

### 8. `usePresentationStore()` / `useQueueStore()` with no selector — wide re-renders
**Files:** `src/routes/services/$serviceId.tsx`, `src/routes/playing-now/index.tsx`
Subscribes to entire store → re-renders on every projection event.
**Fix:** Use specific field selectors: `useQueueStore(s => s.queue)` not `useQueueStore()`.
**Impact:** Eliminates spurious re-renders during active worship service.

### 9. Global QueryClient missing `gcTime` + `refetchOnWindowFocus: false`
**File:** `src/main.tsx:30`
Every alt-tab to the main window triggers a refetch burst on ALL mounted queries.
**Fix:**
```ts
new QueryClient({ defaultOptions: { queries: {
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
}}})
```
**Impact:** Eliminates alt-tab IPC burst; critical for worship use (frequent window switching).

### 10. `useAlbums` / `useAllHymns` / `useHymnAudioPath` — no staleTime on immutable data
**File:** `src/lib/queries/music.ts`
These datasets never change during a session but re-fetch on every component mount.
**Fix:** `staleTime: Infinity` (albums never change), `staleTime: 1000 * 60 * 5` (hymn list).
**Impact:** Eliminates redundant IPC calls for static data.

### 11. `useImageSrc` — raw IPC `join()` per mount, no cross-component cache
**File:** `src/hooks/use-image-src.ts:36`
200 IPC calls on grid mount (one per cover image). No deduplication.
**Fix:** Convert to `useQuery(['image-path', path], () => resolveImagePath(path), { staleTime: Infinity })`.
⚠️ **RISK:** Existing `cancelled` guard must be removed carefully; TanStack Query handles deduplication.
**Impact:** 200→1 IPC calls for duplicate paths; ~0 calls after first mount.

### 12. `useStreamingStatus` polling every 2s — 30 IPC calls/min during streaming
**File:** `src/lib/queries/music.ts` (or hooks)
Active polling while streaming is live.
**Fix:** Replace with `listen("streaming-status-changed", ...)` Tauri event + emit from Rust on state change.
⚠️ **RISK:** Requires adding `app.emit("streaming-status-changed", ...)` in streaming Rust code.
**Impact:** Eliminates continuous IPC load during worship streaming.

### 13. `content_dbs: Arc<Mutex<...>>` blocks all DB reads on pack sync write
**File:** `src-tauri/src/state.rs`
Read-heavy map under exclusive lock.
**Fix:** `Arc<RwLock<HashMap<String, Pool<...>>>>` — concurrent reads, exclusive only on pack sync.
⚠️ **RISK:** All `.lock()` calls must become `.read()` (reads) or `.write()` (pack sync).
**Impact:** Eliminates read contention during content DB queries.

### 14. `search_hymns` / `search_all_hymns` use `prepare()` not `prepare_cached()`
**File:** `src-tauri/src/db/queries/music/music_app.rs`, `music_content_db.rs`
SQL re-parsed on every keystroke.
**Fix:** `conn.prepare_cached("SELECT ...")` — rusqlite LRU-caches statements per connection.
**Impact:** Measurable latency reduction on search (especially content DBs with complex FTS queries).

### 15-18. Additional High findings
- **`useBibleVersions`, `useBooks`, `useMonitors`, `useAlbums`** — all missing `staleTime` (static session data). One-liner fix each: `staleTime: Infinity`.

---

## 🟡 MEDIUM Priority (26)
See individual report files for full details. Key items:

| Finding | File | Fix |
|---------|------|-----|
| `identify_monitors` is `async fn` with no `.await` | commands/ | Change to `fn` |
| `plan_pack_sync` wraps DB reads in `block_in_place` unnecessarily | pack_sync/ | Remove wrapper |
| Video server polling every 2s during video playback | hooks/use-video-source | Replace with event |
| Spotlight window WebView kept alive ~20MB entire session | __root.tsx | Lazy create/destroy |
| `useDebouncedValue` duplicated across components | multiple | Extract to shared hook |
| `useAudio()` full store subscription re-renders on every audio tick | hooks/use-audio | Add field selectors |
| `useUpdateHymn`/`useDeleteHymn` broad `invalidateQueries` | queries/music.ts | Narrow invalidation keys |
| Missing `gcTime` on all queries (defaults to 5min) | lib/queries/*.ts | Add `gcTime: 10 * 60 * 1000` |
| Double `useThemeStore` subscription in root layout | __root.tsx | Merge into single selector |
| Streaming server started synchronously in setup() | lib.rs | Spawn in background thread |

---

## 🟢 LOW Priority (15)
- `tokio "macros"` feature unused (Tauri owns the runtime)
- `join()` IPC for image paths should use JS `path.join()` equivalent (string concat)
- `serde_json::to_vec` without capacity hint in manifest cache
- No Tokio thread pool cap (~16MB wasted on 4-core machines)
- `useDebouncedValue` duplicate implementations
- HMR-safe: video player module-level subscribe leaks during dev
- `CoverImage` double-renders on path change (minor)
- `hymn-search.tsx` — 4 separate `useMedia` calls → consolidate to 1
- And 7 more in detail reports

---

## Implementation Priority Order

**Do first (no new Rust commands needed, low risk):**
1. `Cargo.toml` release profile (1 change, free wins)
2. SQLite PRAGMAs on all pools (migrations.rs + lib.rs)
3. `Pool::new()` → `max_size(4)`, `min_idle(0)`
4. `QueryClient` defaults (`gcTime` + `refetchOnWindowFocus: false`)
5. `staleTime: Infinity` on static queries (albums, monitors, books, audio paths)
6. `content_dbs` Mutex → RwLock
7. `prepare()` → `prepare_cached()` on search queries

**Do second (small new Rust command needed):**
8. `get_all_favorite_ids` batch endpoint
9. `streaming-status-changed` Tauri event
10. Audio init background thread with timeout

**Do third (larger refactor, more risk):**
11. `handleProjectCollection` Promise.all / batch command
12. `useImageSrc` → TanStack Query
13. Zustand store selectors audit
14. Video server polling → event

---

## Research Docs
- [Tauri 2 Performance Best Practices](./tauri-performance.md)
- [Rust Performance Best Practices](./rust-performance.md)
- [React/TanStack Performance Best Practices](./react-performance.md)
