# Bible Module Performance & State Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist Bible navigation state across tab switches, remove dead code, and fix O(n²) verse lookups.

**Architecture:** New `useBibleStore` Zustand store (no persist middleware) replaces local `useState` in `useBible()`. Hook API surface stays identical — `bible/index.tsx` needs no changes. Three other surgical fixes: delete dead function, replace `Array.includes` with `Set.has`, remove unused `lib/tauri.ts` wrappers.

**Tech Stack:** Zustand, React 19, TypeScript 5.8

---

### Task 1: Create `useBibleStore`

**Files:**
- Create: `src/stores/bible-store.ts`

**Step 1: Create the store**

```ts
import { create } from "zustand";

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

export const useBibleStore = create<BibleState>((set) => ({
  currentVersionId: 0,
  currentBook: "",
  currentChapter: 0,
  selectedVerses: [],
  lastSelectedVerse: null,
  setVersion: (id) =>
    set({ currentVersionId: id, currentBook: "", currentChapter: 0, selectedVerses: [], lastSelectedVerse: null }),
  setBook: (book) =>
    set({ currentBook: book, currentChapter: 0, selectedVerses: [], lastSelectedVerse: null }),
  setChapter: (chapter) =>
    set({ currentChapter: chapter, selectedVerses: [], lastSelectedVerse: null }),
  setSelectedVerses: (verses) => set({ selectedVerses: verses }),
  setLastSelectedVerse: (verse) => set({ lastSelectedVerse: verse }),
}));
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors on the new file.

**Step 3: Commit**

```bash
git add src/stores/bible-store.ts
git commit -m "feat: add useBibleStore for session-persistent Bible navigation state"
```

---

### Task 2: Migrate `useBible()` to use the store

**Files:**
- Modify: `src/hooks/use-bible.ts`

**Step 1: Replace imports and local state**

Remove these lines (top of file):
```ts
import { useState, useCallback } from "react";
```
Replace with:
```ts
import { useCallback } from "react";
import { useBibleStore } from "../stores/bible-store";
```

**Step 2: Replace the 5 `useState` lines**

Remove:
```ts
const [currentVersionId, setCurrentVersionId] = useState<number>(0);
const [currentBook, setCurrentBook] = useState("");
const [currentChapter, setCurrentChapter] = useState(0);
const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
const [lastSelectedVerse, setLastSelectedVerse] = useState<number | null>(null);
```

Replace with:
```ts
const currentVersionId = useBibleStore((s) => s.currentVersionId);
const currentBook = useBibleStore((s) => s.currentBook);
const currentChapter = useBibleStore((s) => s.currentChapter);
const selectedVerses = useBibleStore((s) => s.selectedVerses);
const lastSelectedVerse = useBibleStore((s) => s.lastSelectedVerse);
const storeSetVersion = useBibleStore((s) => s.setVersion);
const storeSetBook = useBibleStore((s) => s.setBook);
const storeSetChapter = useBibleStore((s) => s.setChapter);
const storeSetSelectedVerses = useBibleStore((s) => s.setSelectedVerses);
const storeSetLastSelectedVerse = useBibleStore((s) => s.setLastSelectedVerse);
```

**Step 3: Update `setVersion`, `setBook`, `setChapter` callbacks**

Replace the three `useCallback` blocks that cascade-reset state:
```ts
const setVersion = useCallback((versionId: number) => {
  storeSetVersion(versionId);
}, [storeSetVersion]);

const setBook = useCallback((book: string) => {
  storeSetBook(book);
}, [storeSetBook]);

const setChapter = useCallback((chapter: number) => {
  storeSetChapter(chapter);
}, [storeSetChapter]);
```
Note: the store's `setVersion`/`setBook`/`setChapter` already cascade-reset downstream fields (defined in Task 1).

**Step 4: Update `selectVerse`, `selectSingleVerse`, `selectVerseRange`, `clearSelection`**

Replace:
```ts
const selectVerse = useCallback((verse: number) => {
  setSelectedVerses((prev) => {
    if (prev.includes(verse)) {
      return prev.filter((v) => v !== verse);
    }
    return [...prev, verse].sort((a, b) => a - b);
  });
  setLastSelectedVerse(verse);
}, []);
```
With:
```ts
const selectVerse = useCallback((verse: number) => {
  const prev = useBibleStore.getState().selectedVerses;
  const next = prev.includes(verse)
    ? prev.filter((v) => v !== verse)
    : [...prev, verse].sort((a, b) => a - b);
  storeSetSelectedVerses(next);
  storeSetLastSelectedVerse(verse);
}, [storeSetSelectedVerses, storeSetLastSelectedVerse]);
```

Replace:
```ts
const selectSingleVerse = useCallback((verse: number) => {
  setSelectedVerses([verse]);
  setLastSelectedVerse(verse);
}, []);
```
With:
```ts
const selectSingleVerse = useCallback((verse: number) => {
  storeSetSelectedVerses([verse]);
  storeSetLastSelectedVerse(verse);
}, [storeSetSelectedVerses, storeSetLastSelectedVerse]);
```

Replace:
```ts
const selectVerseRange = useCallback((start: number, end: number) => {
  const range: number[] = [];
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  setSelectedVerses(range);
  setLastSelectedVerse(start);
}, []);
```
With:
```ts
const selectVerseRange = useCallback((start: number, end: number) => {
  const range: number[] = [];
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  storeSetSelectedVerses(range);
  storeSetLastSelectedVerse(start);
}, [storeSetSelectedVerses, storeSetLastSelectedVerse]);
```

Replace:
```ts
const clearSelection = useCallback(() => {
  setSelectedVerses([]);
  setLastSelectedVerse(null);
}, []);
```
With:
```ts
const clearSelection = useCallback(() => {
  storeSetSelectedVerses([]);
  storeSetLastSelectedVerse(null);
}, [storeSetSelectedVerses, storeSetLastSelectedVerse]);
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 6: Commit**

```bash
git add src/hooks/use-bible.ts
git commit -m "refactor: migrate useBible state to useBibleStore for session persistence"
```

---

### Task 3: Remove dead `projectSingleVerse`

**Files:**
- Modify: `src/hooks/use-bible.ts`

**Step 1: Delete the function**

Remove the entire block (lines 75–93 in current file — `projectSingleVerse` useCallback):
```ts
const projectSingleVerse = useCallback(async (verseNum: number) => {
  ...
}, [currentVersionId, currentBook, currentChapter, versesQuery.data]);
```

**Step 2: Remove from return object**

In the return statement, remove the line:
```ts
projectSingleVerse,
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors (no callers exist).

**Step 4: Commit**

```bash
git add src/hooks/use-bible.ts
git commit -m "refactor: remove unused projectSingleVerse from useBible"
```

---

### Task 4: Fix O(n²) `Array.includes` in verse filters

**Files:**
- Modify: `src/hooks/use-bible.ts` (inside `projectSelectedVersesRange`)
- Modify: `src/components/services/add-item-modal.tsx` (inside `handleAdd`)
- Modify: `src/components/bible/version-comparison.tsx` (inside `VersionComparisonItem`)

**Step 1: Fix `use-bible.ts` — `projectSelectedVersesRange`**

Find:
```ts
const selectedTexts = (versesQuery.data ?? [])
  .filter((v) => sorted.includes(v.verse))
  .map((v) => `${v.verse} ${v.text}`)
  .join("\n");
```
Replace with:
```ts
const verseSet = new Set(sorted);
const selectedTexts = (versesQuery.data ?? [])
  .filter((v) => verseSet.has(v.verse))
  .map((v) => `${v.verse} ${v.text}`)
  .join("\n");
```

**Step 2: Fix `add-item-modal.tsx` — `handleAdd`**

Find:
```ts
const verseTexts = (verses ?? [])
  .filter((v) => sorted.includes(v.verse))
  .map((v) => `${v.verse} ${v.text}`)
  .join("\n");
```
Replace with:
```ts
const verseSet = new Set(sorted);
const verseTexts = (verses ?? [])
  .filter((v) => verseSet.has(v.verse))
  .map((v) => `${v.verse} ${v.text}`)
  .join("\n");
```

**Step 3: Fix `version-comparison.tsx` — `VersionComparisonItem`**

Find:
```ts
const filtered = verses?.filter((v) => selectedVerses.includes(v.verse)) ?? [];
```
Replace with:
```ts
const verseSet = new Set(selectedVerses);
const filtered = verses?.filter((v) => verseSet.has(v.verse)) ?? [];
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add src/hooks/use-bible.ts src/components/services/add-item-modal.tsx src/components/bible/version-comparison.tsx
git commit -m "perf: replace Array.includes with Set.has in verse filters"
```

---

### Task 5: Remove dead Tauri wrappers

**Files:**
- Modify: `src/lib/tauri.ts`

**Step 1: Delete the three dead wrapper functions**

Remove these three functions entirely from `src/lib/tauri.ts`:

```ts
export async function getVerseRange(versionId: number, book: string, chapter: number, start: number, end: number): Promise<Verse[]> {
  return tauriInvoke<Verse[]>("get_verse_range", { versionId, book, chapter, start, end });
}
```

```ts
export async function projectBibleVerse(versionId: number, book: string, chapter: number, start: number, end: number): Promise<void> {
  return tauriInvoke<void>("project_bible_verse", { versionId, book, chapter, start, end });
}
```

```ts
export async function navigateBibleVerse(direction: "next" | "prev"): Promise<void> {
  return tauriInvoke<void>("navigate_bible_verse", { direction });
}
```

**Step 2: Check nothing imports them**

```bash
npx tsc --noEmit
```
Expected: no errors (confirmed zero callers in prior analysis).

**Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "refactor: remove dead Bible Tauri wrappers (getVerseRange, projectBibleVerse, navigateBibleVerse)"
```
