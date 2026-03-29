# React 19 + TanStack Performance Best Practices (≤8GB RAM Desktop)

> Context: Tauri 2 desktop app (LouvorJA). No network latency — all data comes from local SQLite via IPC. Memory pressure is real at ≤8GB. Electron/browser tab isolation does NOT apply — crashes affect the whole app.

---

## Render Optimization

### React Compiler (Automatic Memoization)

React 19 ships with an opt-in **React Compiler** that automatically inserts `useMemo`, `useCallback`, and `React.memo` at build time. When enabled:

- Manual `memo()` wrappers become mostly unnecessary
- Intermediate computed values are memoized automatically
- No `useCallback` needed for stable function props

**Status for this project:** The compiler is not yet enabled. Until it is, use the manual patterns below.

```bash
# To enable (when ready):
pnpm add -D babel-plugin-react-compiler
# Configure in vite.config.ts
```

### Manual `React.memo` Rules

Use `memo()` **only** after profiling confirms unnecessary re-renders:

```tsx
// Good candidate: list item rendered 500+ times, receives same hymn prop
const HymnRow = memo(function HymnRow({ hymn, onSelect }: Props) { ... });

// Bad candidate: component that always receives new object props
// memo() does nothing if props are new objects each render
```

Decision tree:
1. Is there perceptible lag? → Profile first with React DevTools
2. Does the component re-render often with unchanged props? → Use `memo`
3. Can you simplify props (pass primitives instead of objects)? → Do that first
4. Enable React Compiler → Remove all manual `memo`

**Anti-pattern:** Passing object/array literals as props breaks memoization:

```tsx
// Breaks memo on HymnCard every render:
<HymnCard style={{ color: 'red' }} />

// Fix: use useMemo or extract constant outside component:
const cardStyle = { color: 'red' } as const; // outside component
```

### `useMemo` and `useCallback`

Use sparingly — React 19 with compiler makes these obsolete. Without compiler:

```tsx
// useMemo: for expensive derivations (filter/sort large hymn lists)
const filtered = useMemo(
  () => hymns.filter(h => h.title.includes(query)),
  [hymns, query]
);

// useCallback: only when passing stable function refs to memo() children
const handleSelect = useCallback((id: number) => {
  navigate({ to: '/hymnal/$hymnId', params: { hymnId: String(id) } });
}, [navigate]);
```

### `useDeferredValue` for Search Inputs

React 19 supports an initial value parameter, preventing blank states:

```tsx
// Show '' immediately while deferred value catches up
const deferredQuery = useDeferredValue(query, '');
const results = useHymns(deferredQuery);
```

**Note:** The codebase already uses a manual `setTimeout` debounce for hymn search. `useDeferredValue` is complementary — debounce reduces IPC calls, `useDeferredValue` keeps the UI responsive during the re-render triggered by debounced state updates.

### State Colocation

Keep state as close to where it's used as possible. Lifting state to a parent causes the parent + all siblings to re-render:

```tsx
// Bad: query state in parent causes all siblings to re-render on every keystroke
function HymnalRoute() {
  const [query, setQuery] = useState('');
  return (
    <>
      <HymnSearch query={query} onChange={setQuery} />
      <AlbumList /> {/* re-renders on every keystroke even though it doesn't use query */}
    </>
  );
}

// Good: query lives inside HymnSearch, siblings unaffected
```

### `useRef` for Non-Visual Data

Use `useRef` for values that should not trigger re-renders (timers, dirty flags, previous values):

```tsx
// Dirty ref pattern (already used for dead-key fix) — correct approach:
const dirtyRef = useRef(false);
// Changing dirtyRef.current = true never causes a re-render
```

### Keys in Lists

Never use array index or `Math.random()` as keys — causes full re-mount on sort/filter. Always use stable, unique IDs:

```tsx
// Good: hymn.id is stable
hymns.map(h => <HymnCard key={h.id} hymn={h} />)

// Bad: index shifts on filter, causing wrong state
hymns.map((h, i) => <HymnCard key={i} hymn={h} />)
```

### `use()` Hook with Suspense

React 19's `use()` reads a promise inside render, suspending the tree automatically:

```tsx
function HymnDetail({ hymnPromise }: { hymnPromise: Promise<Hymn> }) {
  const hymn = use(hymnPromise); // suspends until resolved
  return <LyricsDisplay hymn={hymn} />;
}

// Wrap with Suspense boundary:
<Suspense fallback={<Skeleton />}>
  <HymnDetail hymnPromise={hymnPromise} />
</Suspense>
```

For this project, TanStack Query's `useSuspenseQuery` achieves the same effect with cache management included — prefer that over raw `use()` for data fetching.

---

## TanStack Query Configuration

### Global Defaults for a Desktop App

Since all data is local SQLite (no network), configure aggressively to reduce redundant IPC calls:

```tsx
// src/main.tsx or query provider
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 min default — local data doesn't change externally
      gcTime: 10 * 60_000,        // 10 min: balance between memory and cache hits
      refetchOnWindowFocus: false, // Desktop app: no browser tab switching
      refetchOnReconnect: false,   // No network dependency for local data
      retry: 1,                    // SQLite rarely fails transiently
    },
  },
});
```

**Current state:** Several queries (e.g., `useAlbums`, `useHymn`) have no `staleTime` — they default to `0`, causing a refetch on every mount. This is wasteful for static data like albums, Bible books, and settings.

### Per-Query `staleTime` Guidelines

| Data type | Recommended `staleTime` | Notes |
|-----------|------------------------|-------|
| Albums, Bible books, settings | `Infinity` | Never changes during session |
| Hymn list / search results | `60_000` (1 min) | May change after pack sync |
| Active service items | `0` (default) | Mutated frequently, needs fresh reads |
| Slides for a presentation | `30_000` | Already correct in some queries |
| Audio path for hymn | `Infinity` | File path doesn't change |

```tsx
// Example: albums never change during session
export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.albums.all,
    queryFn: () => getAlbums(),
    staleTime: Infinity,      // Never refetch
    gcTime: Infinity,         // Keep in cache forever
  });
}
```

### `queryOptions` Helper for Reuse

Centralize query config to avoid drift between `useQuery` and `prefetchQuery`:

```tsx
// lib/queries/keys.ts or query-options.ts
import { queryOptions } from '@tanstack/react-query';

export const hymnOptions = (id: number) => queryOptions({
  queryKey: queryKeys.hymns.detail(id),
  queryFn: () => getHymn(id),
  staleTime: 60_000,
  enabled: id > 0,
});

// Use consistently:
const { data } = useQuery(hymnOptions(id));
await queryClient.prefetchQuery(hymnOptions(nextId)); // same config
```

### Avoiding Waterfall Queries

A waterfall occurs when query B starts only after query A finishes (because B depends on A's result). Minimize by:

1. **Parallel queries** — fetch independent data simultaneously:

```tsx
// Bad: sequential (waterfall)
const { data: hymn } = useHymn(id);
const { data: audio } = useHymnAudioPath(hymn?.id ?? 0); // waits for hymn

// Better: if you know the ID up front, both fire in parallel
const { data: hymn } = useHymn(id);
const { data: audio } = useHymnAudioPath(id); // fires immediately
```

2. **`useQueries` for dynamic parallel queries:**

```tsx
const results = useQueries({
  queries: selectedHymnIds.map(id => hymnOptions(id)),
});
```

3. **Prefetch on hover/navigation intent** to eliminate perceived latency:

```tsx
// On mouse-enter for a hymn card, prefetch its detail
const queryClient = useQueryClient();
const handleMouseEnter = useCallback(() => {
  queryClient.prefetchQuery(hymnOptions(hymn.id));
}, [hymn.id, queryClient]);
```

### Selector Pattern to Reduce Re-renders

Use the `select` option to transform/filter data — the component only re-renders when the selected value changes, not when other parts of the cached object change:

```tsx
// Only re-renders when title changes, not when audio path or sync points change
const { data: title } = useQuery({
  ...hymnOptions(id),
  select: (h) => h.title,
});

// Stable reference with select for arrays (use with memo'd child components):
const { data: stanzaIds } = useQuery({
  ...hymnOptions(id),
  select: (h) => h.stanzas.map(s => s.id),
});
```

### Avoid Over-fetching After Mutations

After a mutation, invalidate only the specific query keys affected — not entire query groups:

```tsx
// Bad: invalidates ALL hymn queries
queryClient.invalidateQueries({ queryKey: ['hymns'] });

// Good: invalidate only what changed
queryClient.invalidateQueries({ queryKey: queryKeys.hymns.detail(id) });
queryClient.invalidateQueries({ queryKey: queryKeys.hymns.search('') }); // list needs update
```

### `useSuspenseQuery` for Type Safety

Eliminates `data | undefined` checks when you know data must exist before render:

```tsx
// data is guaranteed non-undefined; component suspends until ready
const { data: hymn } = useSuspenseQuery(hymnOptions(id));
// No need for: if (!hymn) return null;
```

---

## List Virtualization

### When to Virtualize

Render ALL items when count is small; virtualize above threshold:

| Item count | Recommendation |
|-----------|----------------|
| < 50 | No virtualization needed |
| 50–200 | Consider virtualization if items are complex (images, audio controls) |
| > 200 | Virtualize |
| > 1000 | Virtualize + avoid heavy item components |

**This codebase:** `HymnSearch` already uses `@tanstack/react-virtual` — correct. `AlbumCard` grid, Bible search results, and service item lists may also benefit if counts grow.

### `@tanstack/react-virtual` Patterns

The project already uses `useVirtualizer`. Key configuration tips:

```tsx
const virtualizer = useVirtualizer({
  count: rowCount,
  getScrollElement: () => document.getElementById("main-scroll-area"),
  estimateSize: () => (view === 'list' ? 60 : 280),
  overscan: 5,    // render 5 extra rows above/below viewport — reduces blank flashes
  gap: 16,
});

// Always render the total size container + absolute-positioned items:
<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
  {virtualizer.getVirtualItems().map(row => (
    <div
      key={row.key}
      style={{ position: 'absolute', top: row.start, width: '100%' }}
    >
      {/* render row items */}
    </div>
  ))}
</div>
```

**`overscan: 5`** is already set — good. Too high (>10) wastes renders; too low (<3) shows blank rows on fast scroll.

### Grid Virtualization

For grid views (album cards), virtualize rows (each row = N columns):

```tsx
const rowCount = Math.ceil(items.length / columns); // already done in HymnSearch
const virtualizer = useVirtualizer({ count: rowCount, estimateSize: () => 280 });
```

When `columns` changes (responsive breakpoint), reset scroll position to avoid stale offsets:

```tsx
useEffect(() => {
  virtualizer.scrollToIndex(0);
}, [columns]);
```

### `react-window` vs `@tanstack/react-virtual`

Stick with `@tanstack/react-virtual` (already in use):
- Headless (no opinion on markup/styling — works with Tailwind)
- Handles dynamic item heights via `measureElement`
- Active maintenance, better TypeScript support
- `react-window` is in maintenance mode

---

## Zustand Patterns

### Selector Granularity — The Most Important Pattern

Every `useStore(state => state)` call subscribes to the **entire store** — re-renders on any change. Always use specific selectors:

```tsx
// Bad: re-renders on ANY store change
const store = usePresentationStore();
const { slides, activeSlideIndex } = store;

// Good: re-renders only when slides changes
const slides = usePresentationStore(s => s.slides);
const activeSlideIndex = usePresentationStore(s => s.activeSlideIndex);
```

### `useShallow` for Object/Array Selections

When selecting multiple fields or a derived object, use `useShallow` to prevent re-renders when the reference changes but values are equal:

```tsx
import { useShallow } from 'zustand/react/shallow';

// Without useShallow: re-renders every time (new object reference each call)
const { slides, totalSlides } = usePresentationStore(s => ({
  slides: s.slides,
  totalSlides: s.slides.length,
}));

// With useShallow: only re-renders when values actually differ
const { slides, totalSlides } = usePresentationStore(
  useShallow(s => ({ slides: s.slides, totalSlides: s.slides.length }))
);
```

### `getState()` in Async Callbacks

Never close over Zustand state in callbacks that run after an async delay — the captured value is stale. Already documented in CLAUDE.md but critical to reinforce:

```tsx
// Bad: stale closure — captures slides at useCallback creation time
const goToSlide = useCallback(async (index: number) => {
  if (index < slides.length) { ... } // `slides` is stale after async ops
}, [slides, projectSlide]);

// Good: fresh read inside callback
const goToSlide = useCallback(async (index: number) => {
  const { slides } = usePresentationStore.getState(); // always fresh
  if (index < slides.length) { ... }
}, [projectSlide]); // no dependency on slides
```

### Store Slicing for Performance

Split large stores into domain-specific slices. This project already does this well (`presentation-store`, `display-store`, `audio-store`, `queue-store`). Avoid merging unrelated concerns into a single store.

### Subscribe Outside React

For non-component logic (event handlers, Tauri event listeners), subscribe directly instead of using hooks:

```tsx
// In a Tauri event listener (outside component):
const unsub = usePresentationStore.subscribe(
  (state) => state.activeServiceId,
  (activeServiceId) => {
    if (activeServiceId) enableAutoSave();
  }
);
// Clean up when no longer needed:
unsub();
```

---

## Bundle & Code Splitting

### Route-Level Code Splitting

TanStack Router with file-based routing automatically enables per-route code splitting when using `lazy` loaders. Ensure heavy routes are split:

```tsx
// In route file ($hymnId.tsx) — already file-based, split automatically by TanStack Router
// For extra-heavy components within a route, use React.lazy:
const AudioSyncEditor = lazy(() => import('../../components/music/audio-sync-editor'));
// Only loads when user opens sync editor, not on hymn list page
```

**Always declare `lazy()` at module level, never inside components.**

### Heavy Library Splitting

Identify large dependencies and lazy-load them:

```tsx
// PPTX import: only needed during import flow
const importPptx = lazy(() => import('../lib/pptx-importer'));

// Audio sync editor: only needed in hymn detail with edit mode
const AudioSyncEditor = lazy(() => import('../components/music/audio-sync-editor'));
```

### Dynamic Imports for Conditional Features

Features only some users use should not be in the initial bundle:

```tsx
// Load admin/debug tools only when activated
const loadDebugPanel = () => import('../components/debug/debug-panel');
```

### Bundle Analysis

```bash
# Analyze bundle to find large chunks:
pnpm vite build --mode production
# Then inspect dist/ with:
npx vite-bundle-visualizer
# or: ANALYZE=true pnpm vite build (if vite-bundle-analyzer plugin is configured)
```

Look for: duplicate dependencies, large locale files, unused icon library exports (lucide-react tree-shakes well; verify).

### Icon Imports

Always use named imports from `lucide-react` — it tree-shakes correctly:

```tsx
// Good: only Search icon in bundle
import { Search } from 'lucide-react';

// Bad: entire icon library in bundle
import * as Icons from 'lucide-react';
```

---

## Memory Leak Prevention

### Event Listener Cleanup

Every `addEventListener` in a `useEffect` must have a cleanup:

```tsx
useEffect(() => {
  const handler = (e: Event) => { ... };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler); // required
}, []);
```

### Tauri Event Listener Cleanup

**Critical for this app.** Tauri `listen()` returns an `UnlistenFn` — always call it on cleanup:

```tsx
useEffect(() => {
  let unlisten: UnlistenFn | undefined;

  listen<SlideContentFlat>('slide-changed', (event) => {
    setCurrentSlide(event.payload);
  }).then(fn => { unlisten = fn; });

  return () => { unlisten?.(); }; // prevents duplicate listeners on re-mount
}, []);
```

Without cleanup, each re-mount of a component adds another listener. Over a session, this accumulates and causes duplicate slide projections, extra state updates, and memory growth.

### Interval/Timeout Cleanup

```tsx
useEffect(() => {
  const id = setInterval(pollStatus, 5000);
  return () => clearInterval(id); // always clean up
}, []);
```

### TanStack Query Subscription Cleanup

`useQueryClient()` subscriptions via `queryClient.getQueryCache().subscribe()` must be unsubscribed:

```tsx
useEffect(() => {
  const unsub = queryClient.getQueryCache().subscribe((event) => { ... });
  return unsub; // TanStack Query returns cleanup function
}, [queryClient]);
```

### Zustand Store Subscriptions

```tsx
useEffect(() => {
  const unsub = useDisplayStore.subscribe(
    (s) => s.isProjectorOpen,
    (open) => { if (!open) cleanup(); }
  );
  return unsub;
}, []);
```

### Avoiding Memory Growth in Long-Running Desktop Sessions

This app runs for hours. Key practices:

1. **Set `gcTime` limits** — don't use `gcTime: Infinity` on large datasets (slide images, audio paths for entire catalog)
2. **URL.createObjectURL** — always call `URL.revokeObjectURL(url)` when done
3. **Image `src` blobs** — revoke on component unmount (relevant for cover images)
4. **No polling loops** — already documented in CLAUDE.md; use Tauri event-driven patterns

```tsx
// Cover image blob URL — revoke on unmount
useEffect(() => {
  const url = URL.createObjectURL(blob);
  setImageUrl(url);
  return () => URL.revokeObjectURL(url);
}, [blob]);
```

### Abort Controllers for Async Operations

When an async operation should be cancelled on unmount:

```tsx
useEffect(() => {
  const controller = new AbortController();

  fetchLargeData({ signal: controller.signal })
    .then(setData)
    .catch(e => { if (e.name !== 'AbortError') setError(e); });

  return () => controller.abort();
}, [id]);
```

---

## Anti-Patterns to Avoid

### Render Anti-Patterns

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| `key={Math.random()}` in lists | Full re-mount every render, destroys state | Use stable IDs |
| `key={index}` when list is sortable/filterable | Wrong state assigned after reorder | Use stable IDs |
| State synchronization via `useEffect` | Extra render pass | Derive during render |
| Effect chains (Effect → setState → Effect) | N extra render passes | Compute in event handler |
| `JSON.stringify` in memo comparison | O(n) deep comparison freezes UI on large objects | Shallow comparison only |
| Creating objects/arrays as default prop values | `[] !== []` breaks memo | Use constants or useMemo |

### TanStack Query Anti-Patterns

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| `staleTime: 0` on static data | IPC call on every mount | Set `staleTime: Infinity` for static |
| `queryClient.invalidateQueries({ queryKey: ['hymns'] })` | Invalidates ALL hymn queries | Target specific keys |
| Query inside a loop | Violates Rules of Hooks; can't be conditional | Use `useQueries` |
| Fetching in `useEffect` instead of `useQuery` | No deduplication, no cache, no loading state | Always use `useQuery` |
| `refetchInterval` on local SQLite data | Wasteful polling — use Tauri events instead | Remove; subscribe to events |

### Zustand Anti-Patterns

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| `useStore(s => s)` (full state selection) | Re-renders on every state change | Select specific fields |
| Closing over store state in `useCallback` with async | Stale values after async gap | Use `getState()` inside callback |
| Large combined stores (all UI + domain state) | Component A triggers Component B re-render | Split into domain stores |
| Computed values in store | Computed on every set, stored unnecessarily | Derive in selector or `useMemo` |

### Effect Anti-Patterns

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| Missing `unlisten?.()` for Tauri events | Duplicate listeners accumulate over session | Always return cleanup |
| Missing `removeEventListener` | Memory leak; handler fires after unmount | Always clean up |
| `useEffect` with no dependency array | Runs after every render | Add correct deps |
| Async `useEffect` without abort/ignore flag | Race condition on rapid re-renders | Use `ignore` flag or AbortController |

---

## React DevTools Profiler Usage

### Identifying Re-render Hotspots

1. Open React DevTools → Profiler tab
2. Click "Record", perform the action (e.g., type in hymn search)
3. Stop recording → examine flame graph
4. Look for: components that re-render when they shouldn't (gray bars = no change, colored = re-rendered)
5. Use "Why did this render?" (highlight updates) to see which prop/state changed

### Key Metrics for This App

- **Hymn search input:** Should only re-render `HymnSearch` + `VirtualList`, not the entire route
- **Slide projection:** `ProjectorView` should re-render only on `slide-changed` events
- **Status bar:** Should not re-render on every keystroke in the hymn search

### Enabling Profiler in Production Build

For Tauri, build with profiler support:
```bash
# Add to vite.config.ts for profiling production builds:
# resolve.alias: { 'react-dom$': 'react-dom/profiling' }
```

---

## Image Lazy Loading and Memoization

### Cover Images

For hymn/album cover images served via the content DB file path:

```tsx
// Lazy load images below the fold in virtualized lists
<img
  src={coverUrl}
  loading="lazy"    // browser-native lazy loading
  decoding="async"  // non-blocking decode
  alt={albumTitle}
/>
```

In Tauri, images are served via `convertFileSrc()` (for asset-protocol files) or the video HTTP server. Both support lazy loading naturally.

### Memoize Resolved URLs

If resolving cover paths is expensive (IPC call), cache the result:

```tsx
// Use TanStack Query to cache resolved paths — not useState:
export function useCoverImageUrl(hymnId: number) {
  return useQuery({
    queryKey: ['cover', hymnId],
    queryFn: () => resolveCoverPath(hymnId),
    staleTime: Infinity, // path never changes
    gcTime: 30 * 60_000, // 30 min in memory
  });
}
```

### Avoid Blob URL Recreation

If converting a file path to a blob URL, memoize and revoke properly (see Memory Leak Prevention section).

---

## Sources

- React 19 release notes: https://react.dev/blog/2024/12/05/react-19
- React Compiler: https://react.dev/learn/react-compiler
- React.memo docs: https://react.dev/reference/react/memo
- React.lazy docs: https://react.dev/reference/react/lazy
- You Might Not Need an Effect: https://react.dev/learn/you-might-not-need-an-effect
- useRef vs useState: https://react.dev/learn/referencing-values-with-refs
- List keys: https://react.dev/learn/rendering-lists
- TanStack Query defaults: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- TanStack Query prefetching: https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
- TanStack Query queryOptions: https://tanstack.com/query/v5/docs/framework/react/guides/query-options
- List virtualization (react-window): https://web.dev/articles/virtualize-long-lists-react-window
- Zustand + React Context: https://tkdodo.eu/blog/zustand-and-react-context
- Vite dynamic imports: https://vite.dev/guide/features#dynamic-import
