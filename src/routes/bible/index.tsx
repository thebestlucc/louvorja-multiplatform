import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useBible } from "../../hooks/use-bible";
import { BookSelector } from "../../components/bible/book-selector";
import { VerseDisplay } from "../../components/bible/verse-display";
import { BibleSearch } from "../../components/bible/bible-search";
import { VersionComparison } from "../../components/bible/version-comparison";
import { resolveBookIndex } from "../../components/bible/book-catalog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Monitor, Square } from "lucide-react";

const VERSE_GRID_COLUMNS = 11;
const PERIODIC_FALLBACK_ORDER_OFFSET = 1000;

export const Route = createFileRoute("/bible/")({
  component: BibleIndex,
  validateSearch: (search: Record<string, unknown>) => ({
    book: (search.book as string) || undefined,
    chapter: search.chapter ? Number(search.chapter) : undefined,
    verse: search.verse ? Number(search.verse) : undefined,
  }),
});

function BibleIndex() {
  type PendingVerseNavigation = {
    book: string;
    chapter: number;
    verseMode: "first" | "last";
  };

  const { t } = useTranslation();
  const bible = useBible();
  const { book, chapter, verse } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const deepLinkApplied = useRef(false);
  const pendingVerseNavigationRef = useRef<PendingVerseNavigation | null>(null);

  // Auto-select first version when loaded
  useEffect(() => {
    if (bible.versions.length > 0 && !bible.currentVersionId) {
      bible.setVersion(bible.versions[0].id);
    }
  }, [bible.versions, bible.currentVersionId, bible.setVersion]);

  // Deep-link from command palette search params
  useEffect(() => {
    if (deepLinkApplied.current) return;
    if (book && bible.currentVersionId > 0) {
      deepLinkApplied.current = true;
      bible.setBook(book);
      if (chapter) {
        bible.setChapter(chapter);
        if (verse) {
          bible.selectVerse(verse);
        }
      }
    }
  }, [book, chapter, verse, bible.currentVersionId, bible.setBook, bible.setChapter, bible.selectVerse]);

  const currentVersion = bible.versions.find((v) => v.id === bible.currentVersionId);
  const availableBooks = useMemo(() => new Set(bible.books.map((b) => b.name)), [bible.books]);
  const orderedBooks = useMemo(
    () =>
      bible.books
        .map((bookEntry, idx) => ({
          ...bookEntry,
          order: resolveBookIndex(bookEntry.name) ?? PERIODIC_FALLBACK_ORDER_OFFSET + idx,
        }))
        .sort((a, b) => a.order - b.order),
    [bible.books],
  );

  const handleSearchNavigate = (book: string, chapter: number, verse: number) => {
    pendingVerseNavigationRef.current = null;
    setSearchQuery("");
    bible.setBook(book);
    bible.setChapter(chapter);
    bible.selectVerse(verse);
  };

  const handleDoubleClickVerse = useCallback(
    (verseNum: number) => {
      if (bible.isProjecting) {
        bible.selectSingleVerse(verseNum);
        void bible.updateBibleProjection();
      }
    },
    [bible],
  );

  useEffect(() => {
    const pending = pendingVerseNavigationRef.current;
    if (!pending) return;
    if (bible.currentBook !== pending.book || bible.currentChapter !== pending.chapter) return;
    if (bible.verses.length === 0) return;

    const targetVerse = pending.verseMode === "first"
      ? 1
      : bible.verses[bible.verses.length - 1]?.verse ?? null;

    if (targetVerse === null) return;

    bible.selectSingleVerse(targetVerse);
    pendingVerseNavigationRef.current = null;
  }, [bible.currentBook, bible.currentChapter, bible.verses, bible.selectSingleVerse]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const focusedElement = e.target instanceof HTMLElement ? e.target : null;
      const focusedGrid = focusedElement?.dataset.bibleGrid;
      const parseGridValue = (value: string | undefined): number | null => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };
      const focusedVerse = parseGridValue(focusedElement?.dataset.verse);
      const focusedChapter = parseGridValue(focusedElement?.dataset.chapter);

      const focusSelectedChapter = () => {
        const selected = document.querySelector<HTMLButtonElement>('button[data-bible-grid="chapter"][data-selected="true"]');
        if (selected) {
          selected.focus();
          return;
        }
        const first = document.querySelector<HTMLButtonElement>('button[data-bible-grid="chapter"]');
        first?.focus();
      };

      const focusSelectedBook = () => {
        const selected = document.querySelector<HTMLButtonElement>('button[data-bible-grid="book"][data-selected="true"]');
        if (selected) {
          selected.focus();
          return;
        }
        const firstAvailable = document.querySelector<HTMLButtonElement>('button[data-bible-grid="book"]:not([disabled])');
        firstAvailable?.focus();
      };

      const { currentBook, currentChapter, verses, lastSelectedVerse, selectedVerses, isProjecting } = bible;
      const currentBookIndex = orderedBooks.findIndex((bookEntry) => bookEntry.name === currentBook);
      const currentBookEntry = currentBookIndex >= 0 ? orderedBooks[currentBookIndex] : null;
      const chapterCount = currentBookEntry?.chapterCount ?? 0;

      const navigateToBoundaryVerse = (
        targetBook: string,
        targetChapter: number,
        verseMode: "first" | "last",
      ) => {
        pendingVerseNavigationRef.current = {
          book: targetBook,
          chapter: targetChapter,
          verseMode,
        };
        if (targetBook !== currentBook) {
          bible.setBook(targetBook);
        }
        bible.setChapter(targetChapter);
      };

      if (focusedGrid === "book" && e.key.startsWith("Arrow")) {
        if (e.key === "ArrowDown" && currentBook && chapterCount > 0) {
          e.preventDefault();
          focusSelectedChapter();
        }
        return;
      }

      if (focusedGrid === "chapter" && e.key.startsWith("Arrow")) {
        if (!currentBook || chapterCount <= 0) return;
        const activeChapter = focusedChapter ?? (currentChapter > 0 ? Math.min(currentChapter, chapterCount) : 1);

        const moveToChapter = (chapter: number) => {
          const clamped = Math.max(1, Math.min(chapter, chapterCount));
          bible.setChapter(clamped);
        };

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            if (activeChapter <= VERSE_GRID_COLUMNS) {
              focusSelectedBook();
              return;
            }
            moveToChapter(activeChapter - VERSE_GRID_COLUMNS);
            return;
          case "ArrowDown":
            e.preventDefault();
            moveToChapter(activeChapter + VERSE_GRID_COLUMNS);
            return;
          case "ArrowLeft":
            e.preventDefault();
            moveToChapter(activeChapter - 1);
            return;
          case "ArrowRight":
            e.preventDefault();
            moveToChapter(activeChapter + 1);
            return;
        }
      }

      if (!currentBook || currentChapter <= 0 || verses.length === 0) return;

      const verseCount = verses.length;
      const selectedTail = selectedVerses[selectedVerses.length - 1];
      const clampedLast = lastSelectedVerse && lastSelectedVerse > 0
        ? Math.min(lastSelectedVerse, verseCount)
        : null;
      const activeVerse = clampedLast ?? (selectedTail ? Math.min(selectedTail, verseCount) : 1);

      const moveToVerse = (verse: number) => {
        const clamped = Math.max(1, Math.min(verse, verseCount));
        bible.selectSingleVerse(clamped);
        if (isProjecting) {
          void bible.updateBibleProjection();
        }
      };

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (activeVerse < verseCount) {
            moveToVerse(activeVerse + 1);
            break;
          }

          if (currentChapter < chapterCount) {
            navigateToBoundaryVerse(currentBook, currentChapter + 1, "first");
            break;
          }

          if (currentBookIndex >= 0 && currentBookIndex < orderedBooks.length - 1) {
            const nextBook = orderedBooks[currentBookIndex + 1];
            navigateToBoundaryVerse(nextBook.name, 1, "first");
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (activeVerse > 1) {
            moveToVerse(activeVerse - 1);
            break;
          }

          if (currentChapter > 1) {
            navigateToBoundaryVerse(currentBook, currentChapter - 1, "last");
            break;
          }

          if (currentBookIndex > 0) {
            const previousBook = orderedBooks[currentBookIndex - 1];
            navigateToBoundaryVerse(previousBook.name, previousBook.chapterCount, "last");
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          moveToVerse(activeVerse + VERSE_GRID_COLUMNS);
          break;
        case "ArrowUp":
          if (focusedGrid === "verse" && (focusedVerse ?? activeVerse) <= VERSE_GRID_COLUMNS) {
            e.preventDefault();
            focusSelectedChapter();
            return;
          }
          e.preventDefault();
          moveToVerse(activeVerse - VERSE_GRID_COLUMNS);
          break;
        case "Enter":
        case " ":
        case "Spacebar":
          e.preventDefault();
          bible.selectSingleVerse(activeVerse);
          if (isProjecting) {
            void bible.updateBibleProjection();
          }
          break;
      }
    },
    [bible, orderedBooks],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.bible")}</h1>
        <div className="flex items-center gap-2">
          {bible.versions.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{t("bible.selectVersion")}</span>
              <Select
                value={String(bible.currentVersionId)}
                onValueChange={(val) => bible.setVersion(Number(val))}
              >
                <SelectTrigger className="w-52 sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bible.versions.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.abbreviation} — {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {bible.isProjecting ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await bible.stopBibleProjection();
              }}
            >
              <Square className="mr-2 h-4 w-4" />
              {t("bible.stopProjection")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await bible.startBibleProjection();
              }}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t("bible.project")}
            </Button>
          )}
        </div>
      </div>

      {bible.isLoadingVersions && (
        <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
      )}

      {/* Main two-panel layout */}
      {bible.currentVersionId > 0 && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          {/* Left panel: Verse display */}
          <div className="order-2 min-h-0 flex-1 overflow-y-auto rounded-lg border bg-surface p-4 lg:order-1 lg:w-[38%] lg:flex-none">
            {bible.currentBook && bible.currentChapter > 0 ? (
              <div className="space-y-4">
                <VerseDisplay
                  verses={bible.verses}
                  selectedVerses={bible.selectedVerses}
                  scrollToVerse={bible.lastSelectedVerse}
                  book={bible.currentBook}
                  chapter={bible.currentChapter}
                  versionAbbr={currentVersion?.abbreviation}
                  onSelectVerse={bible.selectVerse}
                  onDoubleClickVerse={handleDoubleClickVerse}
                  isLoading={bible.isLoadingVerses}
                />

                <VersionComparison
                  currentVersionId={bible.currentVersionId}
                  book={bible.currentBook}
                  chapter={bible.currentChapter}
                  selectedVerses={bible.selectedVerses}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("bible.selectBook")}</p>
              </div>
            )}
          </div>

          {/* Right panel: Search + Periodic table + Chapters */}
          <div className="order-1 space-y-3 lg:order-2 lg:flex-1">
            <BibleSearch
              query={searchQuery}
              onQueryChange={setSearchQuery}
              versionId={bible.currentVersionId}
              onNavigate={handleSearchNavigate}
              availableBooks={availableBooks}
            />

            {bible.isLoadingBooks ? (
              <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
            ) : (
              <BookSelector
                books={bible.books}
                currentBook={bible.currentBook}
                currentChapter={bible.currentChapter}
                verseCount={bible.verses.length}
                selectedVerses={bible.selectedVerses}
                onSelectBook={bible.setBook}
                onSelectChapter={bible.setChapter}
                onSelectVerse={bible.selectVerse}
                onDoubleClickVerse={handleDoubleClickVerse}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
