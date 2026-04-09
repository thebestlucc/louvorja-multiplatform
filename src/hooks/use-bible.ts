import { useCallback, useEffect, useState } from "react";
import { catcher } from "../lib/catcher";
import { getPreference, setPreference } from "../lib/store";
import { useBibleVersions, useBooks, useVerses } from "../lib/queries";
import { clearCurrentSlide } from "../lib/tauri";
import { clearActivePlayback } from "../lib/projection-playback";
import { projectBibleVerse, clearBibleProjection } from "../lib/tauri/bible";
import { useDisplayStore, type BibleContext } from "../stores/display-store";
import { useQueueStore } from "../stores/queue-store";

import type { BibleProjectionSettings } from "../components/bible/projection-settings";

export function useBible(projectionSettings?: BibleProjectionSettings) {
  const [currentVersionId, setCurrentVersionId] = useState(0);
  const [currentBook, setCurrentBook] = useState("");
  const [currentChapter, setCurrentChapter] = useState(0);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [lastSelectedVerse, setLastSelectedVerse] = useState<number | null>(null);

  // Restore saved version on mount
  useEffect(() => {
    getPreference<number>("bible.selectedVersionId", 0).then((saved) => {
      if (saved && saved > 0) setCurrentVersionId(saved);
    });
  }, []);

  const { data: versions = [], isLoading: isLoadingVersions } = useBibleVersions();
  const { data: books = [], isLoading: isLoadingBooks } = useBooks(currentVersionId);
  const { data: verses = [], isLoading: isLoadingVerses } = useVerses(currentVersionId, currentBook, currentChapter);

  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const setCurrentProjectionType = useDisplayStore((s) => s.setCurrentProjectionType);
  const setBibleContext = useDisplayStore((s) => s.setBibleContext);
  const addToQueue = useQueueStore((s) => s.addToQueue);

  // Listen for bible context changes from Rust navigate_bible command
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<BibleContext>("bible-context-changed", (event) => {
        if (!cancelled) {
          setBibleContext(event.payload);
        }
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [setBibleContext]);

  const isProjecting = currentProjectionType === "bible";

  const setVersion = (id: number) => {
    setCurrentVersionId(id);
    void setPreference("bible.selectedVersionId", id);
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

  const selectVerseRange = (anchor: number, end: number) => {
    const min = Math.min(anchor, end);
    const max = Math.max(anchor, end);
    const range: number[] = [];
    for (let i = min; i <= max; i++) range.push(i);
    setSelectedVerses(range);
    setLastSelectedVerse(end);
  };

  const projectSelectedVersesRange = useCallback(async (overrideVerses?: number[]) => {
    const effectiveVerses = overrideVerses ?? selectedVerses;
    if (effectiveVerses.length === 0) return;

    const sorted = [...effectiveVerses].sort((a, b) => a - b);
    const range = sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
    const title = `${currentBook} ${currentChapter}:${range}`;

    addToQueue([{
      id: crypto.randomUUID(),
      title,
      type: "projection"
    }], true);

    // Build settings JSON for Rust (includes mode, background, text styling, font)
    const ps = projectionSettings;
    const settingsJson = ps ? JSON.stringify({
      mode: {
        alignment: ps.textAlign ?? "center",
        refPosition: ps.referencePosition === "bottom" ? "bottom" : "top",
        textShadow: ps.textShadow ?? false,
        gradient: ps.backgroundGradient ? {
          angle: ps.backgroundGradient.angle,
          startColor: ps.backgroundGradient.from,
          endColor: ps.backgroundGradient.to,
        } : null,
        fontFamily: ps.fontFamily === "__system__" ? null : (ps.fontFamily ?? null),
      },
      background: {
        kind: ps.backgroundImage ? "image" : ps.backgroundGradient ? "gradient" : "solid",
        color: ps.backgroundGradient ? ps.backgroundGradient.from : (ps.backgroundColor ?? "#1a1a2e"),
        imagePath: ps.backgroundImage ?? null,
        gradientStart: ps.backgroundGradient?.from ?? null,
        gradientEnd: ps.backgroundGradient?.to ?? null,
        gradientAngle: ps.backgroundGradient?.angle ?? null,
        opacity: null,
      },
      textColor: ps.textColor ?? null,
      textSize: ps.textSize ?? null,
      fontFamily: ps.fontFamily === "__system__" ? null : (ps.fontFamily ?? null),
    }) : undefined;

    // Project via Rust — initializes split cache + cosmic-text measurement
    await catcher(
      projectBibleVerse(currentVersionId, currentBook, currentChapter, sorted[0], sorted[0], settingsJson),
      { notify: true },
    );
  }, [currentVersionId, currentBook, currentChapter, selectedVerses, projectionSettings]);

  const startBibleProjection = useCallback(async () => {
    await clearActivePlayback();
    setCurrentProjectionType("bible");
    await projectSelectedVersesRange();
    if (selectedVerses.length > 0) {
      setBibleContext({
        versionId: currentVersionId,
        book: currentBook,
        chapter: currentChapter,
        verseNumber: selectedVerses[0],
        partIndex: 0,
        totalParts: 1,
      });
    }
  }, [projectSelectedVersesRange, setCurrentProjectionType, setBibleContext, selectedVerses, currentVersionId, currentBook, currentChapter]);

  const updateBibleProjection = useCallback(async (overrideVerses?: number[]) => {
    if (isProjecting) {
      await projectSelectedVersesRange(overrideVerses);
    }
  }, [isProjecting, projectSelectedVersesRange]);

  const stopBibleProjection = useCallback(async () => {
    const [, error] = await catcher(clearCurrentSlide(), { notify: true });
    if (!error) {
      setCurrentProjectionType(null);
      setBibleContext(null);
      void catcher(clearBibleProjection());
    }
  }, [setCurrentProjectionType, setBibleContext]);

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
    selectVerseRange,
    lastSelectedVerse,
    isProjecting,
    startBibleProjection,
    stopBibleProjection,
    updateBibleProjection,
  };
}
