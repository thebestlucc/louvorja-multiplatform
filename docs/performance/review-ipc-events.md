# IPC & Tauri Event Performance Review

**Date:** 2026-03-29
**Scope:** IPC layer, Tauri event patterns, query caching, polling, image loading
**Target:** machines with ≤8GB RAM

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 4     |
| Medium   | 7     |
| Low      | 4     |
| **Total** | **15** |

---

## High Severity

---

### [SEVERITY: High] N+1 IPC calls in `handleProjectCollection` for API collections

**File:** `src/routes/collections/index.tsx:157-168`

**Issue:** For API collections, the code fetches all hymns in the collection, then loops over each hymn calling `bindHymnToPlaybackQueue(hymn, 0)` — which internally calls additional IPC commands (audio path resolution, slide generation, etc.) for every hymn sequentially inside a `for...of` loop. For a collection of 50 hymns this fires 50+ serial IPC round-trips before the user sees any feedback. On Windows, each IPC round-trip has ~200ms overhead; 50 hymns = up to 10 seconds of blocking work.

**Current code:**
```ts
const hymns = await getCollectionHymns(collection.id);
for (const hymn of hymns) {
  const slides = (await bindHymnToPlaybackQueue(hymn, 0))?.generatedSlides || [];
  allSlides.push(...slides);
}
```

**Suggested fix:** Parallelize using `Promise.all` — this turns N serial round-trips into 1 fan-out:
```ts
const hymns = await getCollectionHymns(collection.id);
const results = await Promise.all(
  hymns.map((hymn) => bindHymnToPlaybackQueue(hymn, 0))
);
for (const result of results) {
  allSlides.push(...(result?.generatedSlides ?? []));
}
```
Longer-term, expose a Rust command `get_collection_slides(collectionId)` that builds all slides server-side and returns a single JSON payload.

**Impact:** Up to 10× faster collection projection on Windows; significant reduction in IPC bridge contention.

[⚠️ RISK] `Promise.all` may cause concurrent DB reads on the r2d2 pool. Ensure pool `max_size` is ≥ the typical collection size (or add a concurrency limiter, e.g. `p-limit(4)`). If the pool is sized to 1 writer + 4 readers, cap parallelism at 4.

---

### [SEVERITY: High] N+1 IPC calls in `handleProjectCollection` for custom collections

**File:** `src/routes/collections/index.tsx:163-170`

**Issue:** For custom collections, the code fetches the collection detail, then loops over each song calling `getSlides(song.cachePresentationId)` separately — another serial N+1 pattern. A custom collection with 30 songs fires 30 IPC round-trips.

**Current code:**
```ts
const detail = await getCollection(collection.id);
for (const song of detail.songs) {
  if (song.cachePresentationId) {
    const rows = await getSlides(song.cachePresentationId);
    const contents = rows.map((r) => parseSlideRow(r).content);
    allSlides.push(...contents);
  }
}
```

**Suggested fix:** Parallelize using `Promise.all`:
```ts
const detail = await getCollection(collection.id);
const slideArrays = await Promise.all(
  detail.songs
    .filter((s) => s.cachePresentationId)
    .map(async (song) => {
      const rows = await getSlides(song.cachePresentationId!);
      return rows.map((r) => parseSlideRow(r).content);
    })
);
for (const contents of slideArrays) allSlides.push(...contents);
```
Ideal fix: add `get_collection_all_slides(id)` Rust command that JOINs all presentation slides in one query.

**Impact:** Same as above — up to N× speedup where N is the song count.

[⚠️ RISK] Same DB pool concurrency concern as above.

---

### [SEVERITY: High] `useIsFavorite` fires one IPC call per rendered `FavoriteButton` — O(n) on list render

**File:** `src/components/music/favorite-button.tsx:24` / `src/lib/queries/services.ts:148-154`

**Issue:** `FavoriteButton` is rendered inside every `HymnCard` and every collection card. Each mounts and calls `useIsFavorite(itemType, itemId)` — a separate IPC query per item. With a virtualized list of 500 visible rows, this is 500 independent IPC invocations on mount, each returning a single boolean. The query has no `staleTime`, so it also refetches on every component remount.

**Current code:**
```ts
// favorite-button.tsx
const { data: isFav, isLoading } = useIsFavorite(itemType, itemId);

// queries/services.ts
export function useIsFavorite(itemType: string, itemId: number) {
  return useQuery({
    queryKey: queryKeys.favorites.isFavorite(itemType, itemId),
    queryFn: () => isFavorite(itemType, itemId),
    enabled: itemId > 0,
  });
}
```

**Suggested fix:** Add a batch endpoint `get_all_favorites(itemType)` that returns all favorite IDs as a `Set<number>` in one IPC call. Cache it globally with `staleTime: 30_000`. `FavoriteButton` then reads from this cache with a selector instead of firing individual queries:

```ts
// queries/services.ts
export function useFavoriteIds(itemType: string) {
  return useQuery({
    queryKey: queryKeys.favorites.allIds(itemType),
    queryFn: () => getAllFavoriteIds(itemType), // new Rust command: returns number[]
    staleTime: 30_000,
    select: (ids) => new Set(ids),
  });
}

// favorite-button.tsx
const { data: favoriteIds } = useFavoriteIds(itemType);
const isFav = favoriteIds?.has(itemId) ?? false;
```

Interim fix without a new Rust command: add `staleTime: Infinity` to the existing `useIsFavorite` to at least prevent remount refetches.

**Impact:** Reduces N IPC calls per list render to 1. For a hymn list with 500 items, this removes up to 499 unnecessary IPC calls on every mount.

[⚠️ RISK] After `toggleFavorite`, invalidate `queryKeys.favorites.allIds(itemType)` instead of per-item keys. Verify invalidation covers all callers.

---

### [SEVERITY: High] `useStreamingStatus` polls every 2s when streaming is active, every 30s otherwise — should be event-driven

**File:** `src/lib/queries/streaming.ts:14-17`

**Issue:** The streaming status is polled via `refetchInterval`. When streaming is active (`isRunning: true`), this fires an IPC call every 2 seconds indefinitely. This creates a steady stream of IPC traffic even during a worship service when the app should be quiet. The streaming server already uses SSE events — the Rust side can emit a Tauri event when server status changes instead.

**Current code:**
```ts
refetchInterval: (query) => {
  return query.state.data?.isRunning ? 2000 : 30000;
},
```

**Suggested fix:** Remove `refetchInterval`. Subscribe to a `"streaming-status-changed"` Tauri event emitted when the server starts/stops. Invalidate the query from the event listener:
```ts
// In a setup hook or root layout:
useEffect(() => {
  const unlisten = listen<{ isRunning: boolean }>("streaming-status-changed", () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.streaming.status });
  });
  return () => { unlisten.then((fn) => fn()); };
}, [queryClient]);
```
On the Rust side: emit `"streaming-status-changed"` in `start_streaming_server` and `stop_streaming_server` command handlers.

**Impact:** Removes 30 IPC calls/minute during active streaming. Over a 2-hour service = ~3600 prevented round-trips.

[⚠️ RISK] The 30s fallback poll currently catches the case where the server crashes without emitting an event. If removing the poll entirely, the Rust side must guarantee event emission on all exit paths (including panics/crashes), or keep a much longer fallback interval (e.g. 60s) for resilience.

---

## Medium Severity

---

### [SEVERITY: Medium] `useVideoSource` polls every 2s on projection windows — consumes IPC bandwidth during playback

**File:** `src/hooks/use-video-source.ts:26`

**Issue:** On projection/return windows (`isReadOnlyWindow = true`), this hook polls `getVideoServerStatus` every 2 seconds whenever a `path` is set. During video playback this means continuous polling for server metadata that rarely changes (port and access token are stable after server start). The polling continues for the entire duration of video playback.

**Current code:**
```ts
refetchInterval: isReadOnlyWindow && !!path && path.trim().length > 0 ? 2_000 : false,
```

**Suggested fix:** Emit a `"video-server-started"` event from Rust when the server starts (or reuse an existing app-ready event). Projection windows listen for this event and invalidate the query once, then stop polling:
```ts
staleTime: isReadOnlyWindow ? 5_000 : Infinity,
refetchInterval: false, // replaced by event listener
```
Add a `useEffect` in the hook that listens to `"video-server-started"` and calls `queryClient.invalidateQueries({ queryKey: ["video-server-status"] })`.

As a lower-effort interim, increase the interval to 5s or 10s (currently 2s) to halve or quarter the IPC frequency with no code change.

**Impact:** Reduces IPC calls by 30–90% during video projection. On Windows (200ms/IPC), this frees ~100ms of IPC bridge time per 2s interval.

[⚠️ RISK] The 2s poll exists to handle the startup race where the main window may not have started the server yet. Any event-based approach must handle the case where the server starts before the projection window registers its listener (send current state on first connect, or keep a short initial poll of ~5s with a cap of 3 retries).

---

### [SEVERITY: Medium] `useAllHymns` in `music.ts` has no `staleTime` — refetches on every remount

**File:** `src/lib/queries/music.ts:29-33`

**Issue:** `useAllHymns` is used in the Spotlight window search. It has no `staleTime`, defaulting to the global 5-minute staleTime from `main.tsx`. However, the Spotlight window creates its own `QueryClient` instance (`main.tsx:30`), and the Spotlight's `queryClient` may not share the same cache as the main window. Each time the Spotlight opens and runs a search, if the data is stale it will refetch the entire hymn catalog.

**Current code:**
```ts
export function useAllHymns(query: string) {
  return useQuery({
    queryKey: ["hymns", "search-all", query],
    queryFn: () => searchAllHymns(query),
  });
}
```

**Suggested fix:** Add explicit `staleTime` consistent with the rest of the hymn queries:
```ts
export function useAllHymns(query: string) {
  return useQuery({
    queryKey: ["hymns", "search-all", query],
    queryFn: () => searchAllHymns(query),
    staleTime: 30_000,
  });
}
```
Note: the Spotlight window (`spotlight.tsx`) does NOT use `useAllHymns` — it calls `searchAllHymns` directly with a debounce in `useEffect`. This is actually the correct pattern for a transient, non-cached UI. The finding applies to any route that imports `useAllHymns` expecting caching behavior.

**Impact:** Prevents redundant full-catalog searches on Spotlight re-open within 30s windows.

---

### [SEVERITY: Medium] `useAlbums`, `useHymn`, `useHymnAudioPath`, `useSyncPoints`, `useServices`, `useService`, `useCollection`, `useCollectionHymns`, `useIsFavorite` all lack explicit `staleTime`

**File:** `src/lib/queries/music.ts:36-108`, `src/lib/queries/collections.ts:29-146`, `src/lib/queries/services.ts:21-34`

**Issue:** These queries fall back to the global `staleTime: 5 * 60 * 1000` (5 min) set in `main.tsx`. This is acceptable but inconsistent — some of these datasets are session-immutable (audio paths, sync points, albums) and should be `staleTime: Infinity`. Others need faster freshness. Without explicit per-query values, changing the global default breaks all queries simultaneously.

Per the reference doc (`react-performance.md`), recommended values:

| Query | Recommended staleTime |
|---|---|
| `useAlbums` | `Infinity` — albums don't change during session |
| `useHymnAudioPath` | `Infinity` — file path doesn't change |
| `useSyncPoints` | `Infinity` — only mutated by `useSaveSyncPoints` (which invalidates) |
| `useHymn` (detail) | `60_000` — may update after pack sync |
| `useServices` (list) | `30_000` — frequently mutated |
| `useService` (detail) | `0` — actively mutated during service editing |
| `useCollection` (detail) | `30_000` |
| `useCollectionHymns` | `30_000` |

**Current code (example):**
```ts
export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
    // no staleTime — inherits global 5min
  });
}
```

**Suggested fix (example):**
```ts
export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
```

**Impact:** Eliminates unnecessary refetches for static data. For `useHymnAudioPath` (called in every audio play action), this is particularly important — it prevents a refetch on every audio interaction.

---

### [SEVERITY: Medium] `useUpdateHymn` and `useDeleteHymn` invalidate `queryKeys.hymns.all` which re-triggers broad refetches

**File:** `src/lib/queries/music.ts:66-87`

**Issue:** Both mutations invalidate `queryKeys.hymns.all` — a top-level key that matches all hymn-related queries (search results for all queries, `useAllHymns`, etc.). Editing one hymn title causes every cached search result to be refetched. On a machine with hundreds of cached search queries, this creates a burst of IPC calls.

**Current code:**
```ts
onSuccess: (_, vars) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.hymns.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.hymns.detail(vars.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
},
```

**Suggested fix:** Invalidate only the active search cache entry and the specific detail, plus use `setQueryData` for the detail to avoid a round-trip:
```ts
onSuccess: (updatedHymn, vars) => {
  // Update detail cache directly — no IPC round-trip needed
  queryClient.setQueryData(queryKeys.hymns.detail(vars.id), updatedHymn);
  // Invalidate active search results only — not the entire hymns namespace
  queryClient.invalidateQueries({
    queryKey: queryKeys.hymns.search(""),
    exact: false, // matches all search variants
  });
  // Albums only need refresh if album field changed
  queryClient.invalidateQueries({ queryKey: queryKeys.albums.all });
},
```

**Impact:** Reduces post-edit IPC burst from O(cached queries) to O(1).

---

### [SEVERITY: Medium] `useAudio` selects entire `useAudioStore` — re-renders on every audio-status event

**File:** `src/hooks/use-audio.ts:5`

**Issue:** `const store = useAudioStore()` subscribes to the entire store with no selector. The `audio-status` Tauri event fires on every audio tick (at least every few hundred ms during playback), updating `positionMs` and `durationMs` in the store. Any component that calls `useAudio()` re-renders on every tick — including `HymnCard`, action buttons in `ServiceItemList`, status bar controls, etc. if they happen to have `useAudio()` in scope.

**Current code:**
```ts
export function useAudio() {
  const store = useAudioStore(); // full store subscription
  ...
}
```

**Suggested fix:** This hook is already a thin wrapper — consuming components should subscribe only to the fields they need directly:
```ts
// Instead of using useAudio() in components that only need status:
const status = useAudioStore((s) => s.status);

// For the control bar / playing-now (needs all fields):
// OK to use full hook — it's expected to re-render on tick
```
If `useAudio()` must remain a single export, split into a stable part (actions, which never change) and a reactive part (positionMs, status):
```ts
// Stable: useAudioActions() — zero re-renders
// Reactive: useAudioStatus() — re-renders on tick (only in timeline component)
```

**Impact:** Prevents cascade re-renders across components that import `useAudio()` but only use stable actions. Especially important during playback where ticks fire at high frequency.

[⚠️ RISK] Components that currently destructure `store.pause`, `store.play` etc. from `useAudio()` implicitly rely on the full store being subscribed. Switching to granular selectors requires auditing all `useAudio()` call sites to confirm they don't need reactive fields.

---

### [SEVERITY: Medium] `useImageSrc` re-runs on every path change with no cross-component deduplication or caching

**File:** `src/hooks/use-image-src.ts:33-111`

**Issue:** `useImageSrc` resolves a path to a `convertFileSrc` URL via a `useEffect` + `setState`. Each `CoverImage` instance runs this independently with no shared cache. In a list of 200 hymns (grid view), 200 separate `useEffect` calls fire, each awaiting `getCachedAppDataDir()` and `join()`. The `appDataDir` call is cached at module level (good), but `join()` is still an IPC call that runs per-component per-path. For 200 covers, this is 200 IPC `join()` calls on mount.

**Current code:**
```ts
export function useImageSrc(path: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    // IPC calls: getCachedAppDataDir + join
  }, [path]);
  return src;
}
```

**Suggested fix:** Wrap with TanStack Query to deduplicate concurrent calls for the same path and cache results:
```ts
export function useImageSrc(path: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ["image-src", path ?? ""],
    queryFn: () => resolveImageSrc(path), // extracted async function
    enabled: !!path && path.trim().length > 0,
    staleTime: Infinity,   // resolved paths never change
    gcTime: 30 * 60_000,   // 30 min GC — balance memory vs cache hits
  });
  return data ?? null;
}
```

The `join()` IPC call for CDN paths can also be eliminated entirely by constructing the absolute path in JavaScript using the cached `appDataDir` string directly (no IPC needed after the first resolution):
```ts
// After getCachedAppDataDir() resolves once, use string ops:
const absolute = `${appDir}/${normalized.slice(1).replace(/\//g, sep)}`;
```

**Impact:** Reduces IPC calls from O(visible items) per render to O(unique paths) ever. In a grid of 200 hymns with shared album covers, cache hits can reduce IPC from 200 to ~10.

---

## Low Severity

---

### [SEVERITY: Low] `useAudio` hook: `useCallback` captures full `store` object in dependency array

**File:** `src/hooks/use-audio.ts:7-11`

**Issue:** `useCallback` depends on `[store]` — since `store = useAudioStore()` returns a new object on every state change, `togglePlayPause` is recreated on every audio tick. Any component receiving `togglePlayPause` as a prop will see a new reference each tick and fail memoization.

**Current code:**
```ts
const togglePlayPause = useCallback(async () => {
  if (store.status === "playing") {
    await store.pause();
  } else if (store.status === "paused") {
    await store.resume();
  }
}, [store]); // `store` changes every tick
```

**Suggested fix:** Read state inside the callback using `getState()` to remove the dependency:
```ts
const togglePlayPause = useCallback(async () => {
  const { status, pause, resume } = useAudioStore.getState();
  if (status === "playing") {
    await pause();
  } else if (status === "paused") {
    await resume();
  }
}, []); // stable reference — never recreated
```

**Impact:** Stable `togglePlayPause` reference allows memo'd children (control bar buttons) to skip re-renders on audio ticks.

---

### [SEVERITY: Low] `BibleSearch` uses a custom `useDebouncedValue` when the codebase already has debounce patterns — and the debounce delay for book/reference matching is too low

**File:** `src/components/bible/bible-search.tsx:16-23` and `src/components/bible/bible-search.tsx:97-98`

**Issue 1:** `useDebouncedValue` is a local reimplementation of a debounce hook. This is fine functionally but creates a second debounce implementation in the codebase (alongside `HymnSearch`'s inline `setTimeout`). The 300ms debounce for backend FTS search is correct.

**Issue 2:** `bookMatches` and `parsedRef` are computed from the raw (non-debounced) `query` on every keystroke. These are `useMemo` computations over an in-memory `Map` — cheap — but the `matchesBookQuery` function runs against all ~66 books on every character typed. This is fine for 66 books but worth noting.

**Suggested fix:** No change required for correctness. For consistency, extract `useDebouncedValue` to a shared `src/hooks/use-debounced-value.ts` and import it from both `BibleSearch` and `HymnSearch`. Saves a few bytes and ensures a single debounce implementation.

**Impact:** Negligible performance gain; code quality improvement only.

---

### [SEVERITY: Low] `CoverImage` `initials` computation runs on every render (not just when `title` changes)

**File:** `src/components/media/cover-image.tsx:22-29`

**Issue:** `useMemo` for `initials` depends on `[title]` — this is correct. However, `CoverImage` is `memo()`-wrapped, which means it only re-renders when props change. The `useMemo` is effectively redundant because title rarely changes. This is not a bug but an unnecessary dependency in the dep array.

Additionally, the `useEffect(() => { setFailed(false); }, [path])` pattern causes an extra render cycle: path changes → render with old `failed` → effect runs → `setFailed(false)` → second render. For a virtualized list scrolling fast, this double-render per item is multiplied by item count.

**Suggested fix:** Replace the `useEffect` reset with inline logic using a `useRef` tracking the previous path:
```ts
const prevPathRef = useRef(path);
if (prevPathRef.current !== path) {
  prevPathRef.current = path;
  // Reset failed during render (no effect needed)
}
```
Or use a `key` prop on the outer `img` element to force remount when path changes — simpler and React-idiomatic.

**Impact:** Eliminates one extra render per `CoverImage` per path change. In a list of 200 items that all reload covers (e.g. after pack sync), this removes 200 wasted renders.

---

### [SEVERITY: Low] Global `QueryClient` defaults: `refetchOnWindowFocus` and `refetchOnReconnect` not disabled

**File:** `src/main.tsx:30-37`

**Issue:** The global `QueryClient` doesn't set `refetchOnWindowFocus: false` or `refetchOnReconnect: false`. TanStack Query defaults these to `true`. In a desktop app with local SQLite data, focus events (switching between windows, alt-tabbing) trigger refetches of all stale queries. During a worship service where the operator alt-tabs frequently, this creates spurious IPC bursts.

**Current code:**
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});
```

**Suggested fix:**
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
```

**Impact:** Eliminates focus-triggered IPC bursts. Especially relevant for the projector operator who switches windows frequently during a service.

[⚠️ RISK] Queries that currently rely on focus refetch to stay fresh (e.g. `useService` with `staleTime: 0`) will need manual `invalidateQueries` after mutations — which they already do. No functional regression expected.

---

## Patterns Not Found (Confirmed Clean)

The following patterns were checked and **not found** (no action needed):

- **Polling via `setInterval`:** No `setInterval` patterns found in hooks or components. Audio position updates arrive via Tauri `"audio-status"` events correctly.
- **Fetch inside render:** No `invoke()` calls found directly in render bodies. All IPC calls are in `useEffect`, `useQuery`, or event handlers.
- **Missing `unlisten` cleanup:** All Tauri `listen()` calls in hooks (`use-monitors.ts`, `use-media-player.ts`, `audio-store.ts`) correctly call the returned unlisten function on cleanup.
- **HymnSearch debounce:** Already implemented (300ms `setTimeout` pattern). Correct.
- **BibleSearch debounce:** Already implemented (custom `useDebouncedValue`, 300ms). Correct.
- **Spotlight search debounce:** Already implemented (300ms `setTimeout` in `useEffect`). Correct.
- **`CoverImage` lazy loading:** Already uses `loading="lazy"` on the `<img>` element. Correct.
- **`HymnCard` and `AlbumCard` memoization:** Both use `memo()`. Correct.
- **Virtual scrolling:** Both `HymnSearch` and `collections/index.tsx` use `@tanstack/react-virtual` with `overscan: 5`. Correct.
- **`appDataDir` caching in `useImageSrc`:** Module-level promise cache prevents redundant IPC calls. Correct.
- **`useMonitorsControl` event-driven:** Uses `listen()` for `projector-state-changed`, `return-state-changed`, `overlay-changed`. No polling. Correct.
