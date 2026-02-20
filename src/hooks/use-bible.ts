import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useBibleVersions, useBooks, useVerses } from "../lib/queries";
import { setSlideContext, clearCurrentSlide } from "../lib/tauri";
import type { SlideContentFlat } from "../types/presentation";
import { projectSlideWithType } from "../lib/projection-playback";
import { useDisplayStore } from "../stores/display-store";

export function useBible() {
  const [currentVersionId, setCurrentVersionId] = useState<number>(0);
  const [currentBook, setCurrentBook] = useState("");
  const [currentChapter, setCurrentChapter] = useState(0);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [lastSelectedVerse, setLastSelectedVerse] = useState<number | null>(null);

  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const setCurrentProjectionType = useDisplayStore((s) => s.setCurrentProjectionType);

  const versionsQuery = useBibleVersions();
  const booksQuery = useBooks(currentVersionId);
  const versesQuery = useVerses(currentVersionId, currentBook, currentChapter);

  const isProjecting = currentProjectionType === "bible";

  const setVersion = useCallback((versionId: number) => {
    setCurrentVersionId(versionId);
    setCurrentBook("");
    setCurrentChapter(0);
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  }, []);

  const setBook = useCallback((book: string) => {
    setCurrentBook(book);
    setCurrentChapter(0);
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  }, []);

  const setChapter = useCallback((chapter: number) => {
    setCurrentChapter(chapter);
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  }, []);

  const selectVerse = useCallback((verse: number) => {
    setSelectedVerses((prev) => {
      if (prev.includes(verse)) {
        return prev.filter((v) => v !== verse);
      }
      return [...prev, verse].sort((a, b) => a - b);
    });
    setLastSelectedVerse(verse);
  }, []);

  const selectSingleVerse = useCallback((verse: number) => {
    setSelectedVerses([verse]);
    setLastSelectedVerse(verse);
  }, []);

  const selectVerseRange = useCallback((start: number, end: number) => {
    const range: number[] = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    setSelectedVerses(range);
    setLastSelectedVerse(start);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  }, []);

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
