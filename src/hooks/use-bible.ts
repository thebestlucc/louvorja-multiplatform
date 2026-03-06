import { useCallback, useState } from "react";
import { catcher } from "../lib/catcher";
import { useBibleVersions, useBooks, useVerses } from "../lib/queries";
import { setSlideContext, clearCurrentSlide } from "../lib/tauri";
import type { SlideContent } from "../lib/bindings";
import { projectSlideWithType } from "../lib/projection-playback";
import { useDisplayStore } from "../stores/display-store";
import { usePresentationStore } from "../stores/presentation-store";
import { useQueueStore } from "../stores/queue-store";

const EMPTY_SLIDE_PROPS = {
  text: null,
  title: null,
  subtitle: null,
  label: null,
  videoPath: null,
  backgroundImage: null,
  backgroundColor: null,
  audioPath: null,
  autoPlay: null,
  loop: null,
  muted: null,
  mode: null,
  textColor: null,
  textSize: null,
};

export function useBible() {
  const [currentVersionId, setCurrentVersionId] = useState(0);
  const [currentBook, setCurrentBook] = useState("");
  const [currentChapter, setCurrentChapter] = useState(0);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [lastSelectedVerse, setLastSelectedVerse] = useState<number | null>(null);

  const { data: versions = [], isLoading: isLoadingVersions } = useBibleVersions();
  const { data: books = [], isLoading: isLoadingBooks } = useBooks(currentVersionId);
  const { data: verses = [], isLoading: isLoadingVerses } = useVerses(currentVersionId, currentBook, currentChapter);

  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const setCurrentProjectionType = useDisplayStore((s) => s.setCurrentProjectionType);
  const setPresentationSlides = usePresentationStore((s) => s.setSlides);
  const setActiveSlideIndex = usePresentationStore((s) => s.setActiveSlideIndex);
  const setCurrentPresentation = usePresentationStore((s) => s.setCurrentPresentation);
  const addToQueue = useQueueStore((s) => s.addToQueue);

  const isProjecting = currentProjectionType === "bible";

  const setVersion = (id: number) => {
    setCurrentVersionId(id);
    setCurrentBook("");
    setCurrentChapter(0);
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  };

  const setBook = (name: string) => {
    setCurrentBook(name);
    setCurrentChapter(0);
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  };

  const setChapter = (chapter: number) => {
    setCurrentChapter(chapter);
    setSelectedVerses([]);
    setLastSelectedVerse(null);
  };

  const selectVerse = (verse: number) => {
    setSelectedVerses((prev) => {
      const next = prev.includes(verse)
        ? prev.filter((v) => v !== verse)
        : [...prev, verse].sort((a, b) => a - b);
      setLastSelectedVerse(verse);
      return next;
    });
  };

  const selectSingleVerse = (verse: number) => {
    setSelectedVerses([verse]);
    setLastSelectedVerse(verse);
  };

  const projectSelectedVersesRange = useCallback(async () => {
    if (selectedVerses.length === 0) return;

    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const range = sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
    const title = `${currentBook} ${currentChapter}:${range}`;
    const verseSet = new Set(sorted);
    const versesToProject = verses.filter((v) => verseSet.has(v.verse));

    const slides: SlideContent[] = versesToProject.map((v) => ({
      ...EMPTY_SLIDE_PROPS,
      slideType: "bible",
      text: v.text,
      label: `${currentBook} ${currentChapter}:${v.verse}`,
    }));

    setCurrentPresentation(null);
    setPresentationSlides(slides);
    setActiveSlideIndex(0);

    addToQueue([{
      id: crypto.randomUUID(),
      title,
      type: "projection"
    }], true);

    await catcher(async () => {
      await projectSlideWithType(slides[0], "bible");
      await setSlideContext({
        next: slides.length > 1 ? slides[1] : null,
        index: 0,
        total: slides.length,
        title,
      });
    }, { notify: true });
  }, [currentBook, currentChapter, verses, selectedVerses, setActiveSlideIndex, setCurrentPresentation, setPresentationSlides]);

  const startBibleProjection = useCallback(async () => {
    await projectSelectedVersesRange();
  }, [projectSelectedVersesRange]);

  const updateBibleProjection = useCallback(async () => {
    if (isProjecting) {
      await projectSelectedVersesRange();
    }
  }, [isProjecting, projectSelectedVersesRange]);

  const stopBibleProjection = useCallback(async () => {
    const [, error] = await catcher(clearCurrentSlide(), { notify: true });
    if (!error) {
      setCurrentProjectionType(null);
    }
  }, [setCurrentProjectionType]);

  return {
    versions,
    isLoadingVersions,
    currentVersionId,
    setVersion,
    books,
    isLoadingBooks,
    currentBook,
    setBook,
    currentChapter,
    setChapter,
    verses,
    isLoadingVerses,
    selectedVerses,
    selectVerse,
    selectSingleVerse,
    lastSelectedVerse,
    isProjecting,
    startBibleProjection,
    stopBibleProjection,
    updateBibleProjection,
  };
}
