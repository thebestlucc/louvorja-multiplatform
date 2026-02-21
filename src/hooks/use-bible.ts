import { useCallback } from "react";
import { toast } from "sonner";
import { useBibleVersions, useBooks, useVerses } from "../lib/queries";
import { setSlideContext, clearCurrentSlide } from "../lib/tauri";
import type { SlideContentFlat } from "../types/presentation";
import { projectSlideWithType } from "../lib/projection-playback";
import { useDisplayStore } from "../stores/display-store";
import { useBibleStore } from "../stores/bible-store";

export function useBible() {
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

  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const setCurrentProjectionType = useDisplayStore((s) => s.setCurrentProjectionType);

  const versionsQuery = useBibleVersions();
  const booksQuery = useBooks(currentVersionId);
  const versesQuery = useVerses(currentVersionId, currentBook, currentChapter);

  const isProjecting = currentProjectionType === "bible";

  const setVersion = useCallback((versionId: number) => {
    storeSetVersion(versionId);
  }, [storeSetVersion]);

  const setBook = useCallback((book: string) => {
    storeSetBook(book);
  }, [storeSetBook]);

  const setChapter = useCallback((chapter: number) => {
    storeSetChapter(chapter);
  }, [storeSetChapter]);

  const selectVerse = useCallback((verse: number) => {
    const prev = useBibleStore.getState().selectedVerses;
    const next = prev.includes(verse)
      ? prev.filter((v) => v !== verse)
      : [...prev, verse].sort((a, b) => a - b);
    storeSetSelectedVerses(next);
    storeSetLastSelectedVerse(verse);
  }, [storeSetSelectedVerses, storeSetLastSelectedVerse]);

  const selectSingleVerse = useCallback((verse: number) => {
    storeSetSelectedVerses([verse]);
    storeSetLastSelectedVerse(verse);
  }, [storeSetSelectedVerses, storeSetLastSelectedVerse]);

  const selectVerseRange = useCallback((start: number, end: number) => {
    const range: number[] = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    storeSetSelectedVerses(range);
    storeSetLastSelectedVerse(start);
  }, [storeSetSelectedVerses, storeSetLastSelectedVerse]);

  const clearSelection = useCallback(() => {
    storeSetSelectedVerses([]);
    storeSetLastSelectedVerse(null);
  }, [storeSetSelectedVerses, storeSetLastSelectedVerse]);

  const projectSingleVerse = useCallback(async (verseNum: number) => {
    if (!currentVersionId || !currentBook || !currentChapter) return;
    const verseData = (versesQuery.data ?? []).find((v) => v.verse === verseNum);
    if (!verseData) return;

    const reference = `${currentBook} ${currentChapter}:${verseNum}`;
    const slideData: SlideContentFlat = {
      slide_type: "bible",
      text: `${verseData.verse} ${verseData.text}`,
      title: reference,
    };

    try {
      await projectSlideWithType(slideData, "bible");
      await setSlideContext({ next: null, index: 0, total: 1, title: reference });
    } catch (err) {
      toast.error(String(err));
    }
  }, [currentVersionId, currentBook, currentChapter, versesQuery.data]);

  const projectSelectedVersesRange = useCallback(async () => {
    if (selectedVerses.length === 0 || !currentVersionId || !currentBook || !currentChapter) return;
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const start = sorted[0];
    const end = sorted[sorted.length - 1];

    const selectedTexts = (versesQuery.data ?? [])
      .filter((v) => sorted.includes(v.verse))
      .map((v) => `${v.verse} ${v.text}`)
      .join("\n");

    const reference =
      start === end
        ? `${currentBook} ${currentChapter}:${start}`
        : `${currentBook} ${currentChapter}:${start}-${end}`;

    const slideData: SlideContentFlat = {
      slide_type: "bible",
      text: selectedTexts,
      title: reference,
    };

    try {
      await projectSlideWithType(slideData, "bible");
      await setSlideContext({ next: null, index: 0, total: 1, title: reference });
    } catch (err) {
      toast.error(String(err));
    }
  }, [selectedVerses, currentVersionId, currentBook, currentChapter, versesQuery.data]);

  const startBibleProjection = useCallback(async () => {
    setCurrentProjectionType("bible");
    // Project the selected verses if any
    if (selectedVerses.length > 0) {
      await projectSelectedVersesRange();
    }
  }, [selectedVerses, setCurrentProjectionType, projectSelectedVersesRange]);

  const stopBibleProjection = useCallback(async () => {
    try {
      await clearCurrentSlide();
      setCurrentProjectionType(null);
    } catch (err) {
      toast.error(String(err));
    }
  }, [setCurrentProjectionType]);

  const updateBibleProjection = useCallback(async () => {
    if (!isProjecting) return;
    if (selectedVerses.length > 0) {
      await projectSelectedVersesRange();
    } else {
      // If no verses selected while projecting, clear the projection
      await stopBibleProjection();
    }
  }, [isProjecting, selectedVerses, projectSelectedVersesRange, stopBibleProjection]);

  return {
    currentVersionId,
    currentBook,
    currentChapter,
    selectedVerses,
    lastSelectedVerse,
    isProjecting,
    versions: versionsQuery.data ?? [],
    books: booksQuery.data ?? [],
    verses: versesQuery.data ?? [],
    isLoadingVersions: versionsQuery.isLoading,
    isLoadingBooks: booksQuery.isLoading,
    isLoadingVerses: versesQuery.isLoading,
    setVersion,
    setBook,
    setChapter,
    selectVerse,
    selectSingleVerse,
    selectVerseRange,
    clearSelection,
    projectSingleVerse,
    projectSelectedVersesRange,
    startBibleProjection,
    stopBibleProjection,
    updateBibleProjection,
  };
}
