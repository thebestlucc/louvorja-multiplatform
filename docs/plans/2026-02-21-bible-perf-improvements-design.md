# Bible Module Performance & State Improvements

**Date:** 2026-02-21
**Status:** Approved

## Summary

Four targeted improvements to the Bible module and related code:

1. Bible navigation state moved to Zustand (in-session persistence)
2. Remove dead `projectSingleVerse` function
3. Replace O(n²) `Array.includes` in filters with O(1) `Set.has`
4. Remove dead Tauri wrappers for unused backend commands

---

## 1. Bible State → `useBibleStore`

**Problem:** All Bible navigation state lives in local `useState` inside `useBible()`. Switching tabs resets book, chapter, and verse selection.

**Design:**
Create `src/stores/bible-store.ts` — a plain Zustand store (no `persist` middleware). Resets to initial values on app restart automatically.

```ts
interface BibleState {
  currentVersionId: number;
  currentBook: string;
  currentChapter: number;
  selectedVerses: number[];
  lastSelectedVerse: number | null;
  setVersion: (id: number) => void;
  setBook: (book: string) => void;
  setChapter: (chapter: number) => void;
  setSelectedVerses: (verses: number[]) => void;
  setLastSelectedVerse: (verse: number | null) => void;
}
```

`useBible()` reads from `useBibleStore` instead of local `useState`. All setters (`setVersion`, `setBook`, `setChapter`) reset downstream state (same cascade logic as today). No changes to `bible/index.tsx` — the hook API surface is identical.

---

## 2. Remove Dead `projectSingleVerse`

**Problem:** `projectSingleVerse` is defined in `use-bible.ts` and returned from `useBible()`, but has zero callers. The double-click handler uses `selectSingleVerse` + `updateBibleProjection` instead.

**Design:** Delete the function body and remove it from the return object.

---

## 3. Set Lookup for Verse Filtering

**Problem:** Three locations use `Array.includes()` inside `.filter()`, making the inner loop O(n²).

**Files:**
- `src/hooks/use-bible.ts:102` — `projectSelectedVersesRange`
- `src/components/services/add-item-modal.tsx:184`
- `src/components/bible/version-comparison.tsx` — `selectedVerses.includes(v.verse)`

**Design:** Build a `Set` before the filter, use `.has()` inside:

```ts
const verseSet = new Set(sorted); // or new Set(selectedVerses)
.filter((v) => verseSet.has(v.verse))
```

---

## 4. Remove Dead Tauri Wrappers

**Problem:** Three functions in `lib/tauri.ts` wrap backend commands that have no frontend callers and are superseded by the current projection approach.

**Remove:**
- `getVerseRange` — full chapter is fetched via `getVerses`, client-side filtered
- `projectBibleVerse` — superseded by `projectSlideWithType` with `slide_type: "bible"`
- `navigateBibleVerse` — superseded by frontend keyboard navigation in `bible/index.tsx`

**Keep:** `getOverlayState`, `getStreamingStatus` — used by their respective hooks.

---

## Files Affected

| File | Change |
|------|--------|
| `src/stores/bible-store.ts` | **New** — Zustand store |
| `src/hooks/use-bible.ts` | Migrate useState → store, remove dead fn, fix Set lookup |
| `src/components/services/add-item-modal.tsx` | Fix Set lookup |
| `src/components/bible/version-comparison.tsx` | Fix Set lookup |
| `src/lib/tauri.ts` | Remove 3 dead wrappers |
