import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useBible } from "../../hooks/use-bible";
import { BookSelector, NAV_GRID_COLS, BOOK_COLS } from "../../components/bible/book-selector";
import { VerseDisplay } from "../../components/bible/verse-display";
import { BibleSearch } from "../../components/bible/bible-search";
import { VersionComparison } from "../../components/bible/version-comparison";
import { resolveBookIndex } from "../../components/bible/book-catalog";
import {
  ProjectionSettings,
  useProjectionSettings,
} from "../../components/bible/projection-settings";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { Monitor, Square, Settings2 } from "lucide-react";
import { cn } from "../../lib/utils";

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
  const { settings: projectionSettings, updateSettings: updateProjectionSettings } =
    useProjectionSettings();
  const bible = useBible(projectionSettings);
  const { book, chapter, verse } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const deepLinkApplied = useRef(false);
  const pendingVerseNavigationRef = useRef<PendingVerseNavigation | null>(null);
  const shiftAnchorRef = useRef<number | null>(null);
  const initialBookFocusDone = useRef(false);

  // Auto-select default version when loaded (prefer NAA, fall back to first)
  useEffect(() => {
    if (bible.versions.length > 0 && !bible.currentVersionId) {
      const naa = bible.versions.find((v) => v.abbreviation === "NAA");
      bible.setVersion((naa ?? bible.versions[0]).id);
    }
  }, [bible.versions, bible.currentVersionId, bible.setVersion]);

  // Focus first available book on initial load so arrow nav works immediately
  useEffect(() => {
    if (bible.books.length > 0 && !initialBookFocusDone.current) {
      initialBookFocusDone.current = true;
      const btn =
        document.querySelector<HTMLButtonElement>('button[data-bible-grid="book"][data-selected="true"]') ??
        document.querySelector<HTMLButtonElement>('button[data-bible-grid="book"]:not([disabled])');
      btn?.focus();
    }
  }, [bible.books]);

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
  const availableBooks = useMemo(() => new Set<string>(bible.books.map((b) => b.name)), [bible.books]);
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

  const handleSelectVerse = useCallback(
    (verse: number, shiftKey?: boolean) => {
      if (shiftKey && bible.lastSelectedVerse !== null) {
        bible.selectVerseRange(bible.lastSelectedVerse, verse);
      } else {
        bible.selectSingleVerse(verse);
      }
    },
    [bible],
  );

  const handleDoubleClickVerse = useCallback(
    (verseNum: number) => {
      bible.selectSingleVerse(verseNum);
      if (bible.isProjecting) {
        void bible.updateBibleProjection();
      } else {
        void bible.startBibleProjection();
      }
    },
    [bible],
  );

  const handleProjectFromVerseDisplay = useCallback(() => {
    if (bible.isProjecting) {
      void bible.updateBibleProjection();
    } else {
      void bible.startBibleProjection();
    }
  }, [bible]);

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
      const focusedBookIndex = (() => {
        const v = focusedElement?.dataset.bookIndex;
        if (v === undefined) return null;
        const parsed = Number(v);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      })();

      const focusSelectedChapter = () => {
        const selected = document.querySelector<HTMLButtonElement>('button[data-bible-grid="chapter"][data-selected="true"]');
        if (selected) { selected.focus(); return; }
        const first = document.querySelector<HTMLButtonElement>('button[data-bible-grid="chapter"]');
        first?.focus();
      };

      const focusSelectedBook = () => {
        const selected = document.querySelector<HTMLButtonElement>('button[data-bible-grid="book"][data-selected="true"]');
        if (selected) { selected.focus(); return; }
        const firstAvailable = document.querySelector<HTMLButtonElement>('button[data-bible-grid="book"]:not([disabled])');
        firstAvailable?.focus();
      };

      const focusSelectedVerse = () => {
        const selected = document.querySelector<HTMLButtonElement>('button[data-bible-grid="verse"][data-selected="true"]');
        if (selected) { selected.focus(); return; }
        const first = document.querySelector<HTMLButtonElement>('button[data-bible-grid="verse"]');
        first?.focus();
      };

      // Tab / Shift+Tab: cycle sections
      if (e.key === "Tab" && focusedGrid) {
        e.preventDefault();
        if (e.shiftKey) {
          if (focusedGrid === "verse") focusSelectedChapter();
          else if (focusedGrid === "chapter") focusSelectedBook();
          else focusSelectedVerse();
        } else {
          if (focusedGrid === "book") focusSelectedChapter();
          else if (focusedGrid === "chapter") focusSelectedVerse();
          else focusSelectedBook();
        }
        return;
      }

      const { currentBook, currentChapter, verses, lastSelectedVerse, selectedVerses, isProjecting } = bible;
      const currentBookIndex = orderedBooks.findIndex((bookEntry) => bookEntry.name === currentBook);
      const currentBookEntry = currentBookIndex >= 0 ? orderedBooks[currentBookIndex] : null;
      const chapterCount = currentBookEntry?.chapterCount ?? 0;

      const navigateToBoundaryVerse = (
        targetBook: string,
        targetChapter: number,
        verseMode: "first" | "last",
      ) => {
        shiftAnchorRef.current = null;
        pendingVerseNavigationRef.current = { book: targetBook, chapter: targetChapter, verseMode };
        if (targetBook !== currentBook) bible.setBook(targetBook);
        bible.setChapter(targetChapter);
      };

      // Book grid
      if (focusedGrid === "book") {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          if (focusedBookIndex !== null) {
            const entry = orderedBooks.find((b) => resolveBookIndex(b.name) === focusedBookIndex);
            if (entry) bible.setBook(entry.name);
          }
          focusSelectedChapter();
          return;
        }

        if (!e.key.startsWith("Arrow")) return;
        e.preventDefault();

        if (focusedBookIndex === null) {
          if (e.key === "ArrowDown" && currentBook && chapterCount > 0) focusSelectedChapter();
          return;
        }

        const navigateToBook = (index: number): boolean => {
          const btn = document.querySelector<HTMLButtonElement>(
            `button[data-bible-grid="book"][data-book-index="${index}"]`,
          );
          if (!btn) return false;
          btn.focus();
          const entry = orderedBooks.find((b) => resolveBookIndex(b.name) === index);
          if (entry) bible.setBook(entry.name);
          return true;
        };

        switch (e.key) {
          case "ArrowRight":
            navigateToBook(focusedBookIndex + 1);
            break;
          case "ArrowLeft":
            if (focusedBookIndex > 0) navigateToBook(focusedBookIndex - 1);
            break;
          case "ArrowDown":
            if (!navigateToBook(focusedBookIndex + BOOK_COLS)) focusSelectedChapter();
            break;
          case "ArrowUp":
            if (focusedBookIndex >= BOOK_COLS) navigateToBook(focusedBookIndex - BOOK_COLS);
            break;
        }
        return;
      }

      // Chapter grid
      if (focusedGrid === "chapter") {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          if (focusedChapter !== null) bible.setChapter(focusedChapter);
          focusSelectedVerse();
          return;
        }

        if (!e.key.startsWith("Arrow")) return;
        if (!currentBook || chapterCount <= 0) return;
        const activeChapter = focusedChapter ?? (currentChapter > 0 ? Math.min(currentChapter, chapterCount) : 1);

        const moveToChapter = (chapter: number) => {
          const clamped = Math.max(1, Math.min(chapter, chapterCount));
          bible.setChapter(clamped);
        };

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            if (activeChapter <= NAV_GRID_COLS) {
              if (currentBookIndex > 0) {
                const prevBook = orderedBooks[currentBookIndex - 1];
                bible.setBook(prevBook.name);
                bible.setChapter(prevBook.chapterCount);
              } else {
                focusSelectedBook();
              }
              return;
            }
            moveToChapter(activeChapter - NAV_GRID_COLS);
            return;
          case "ArrowDown":
            e.preventDefault();
            if (activeChapter + NAV_GRID_COLS > chapterCount) {
              if (currentBookIndex >= 0 && currentBookIndex < orderedBooks.length - 1) {
                const nextBook = orderedBooks[currentBookIndex + 1];
                bible.setBook(nextBook.name);
                bible.setChapter(1);
              }
              return;
            }
            moveToChapter(activeChapter + NAV_GRID_COLS);
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

      // Verse grid
      if (!currentBook || currentChapter <= 0 || verses.length === 0) return;

      const verseCount = verses.length;
      const selectedTail = selectedVerses[selectedVerses.length - 1];
      const clampedLast = lastSelectedVerse && lastSelectedVerse > 0
        ? Math.min(lastSelectedVerse, verseCount)
        : null;
      const activeVerse = clampedLast ?? (selectedTail ? Math.min(selectedTail, verseCount) : 1);

      const moveToVerse = (verse: number) => {
        shiftAnchorRef.current = null;
        const clamped = Math.max(1, Math.min(verse, verseCount));
        bible.selectSingleVerse(clamped);
        if (isProjecting) void bible.updateBibleProjection();
      };

      const moveToVerseShift = (targetVerse: number) => {
        const clamped = Math.max(1, Math.min(targetVerse, verseCount));
        if (shiftAnchorRef.current === null) shiftAnchorRef.current = activeVerse;
        bible.selectVerseRange(shiftAnchorRef.current, clamped);
        if (isProjecting) void bible.updateBibleProjection();
      };

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) { moveToVerseShift(activeVerse + 1); break; }
          if (activeVerse < verseCount) { moveToVerse(activeVerse + 1); break; }
          if (currentChapter < chapterCount) {
            navigateToBoundaryVerse(currentBook, currentChapter + 1, "first");
            break;
          }
          if (currentBookIndex >= 0 && currentBookIndex < orderedBooks.length - 1) {
            navigateToBoundaryVerse(orderedBooks[currentBookIndex + 1].name, 1, "first");
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) { moveToVerseShift(activeVerse - 1); break; }
          if (activeVerse > 1) { moveToVerse(activeVerse - 1); break; }
          if (currentChapter > 1) {
            navigateToBoundaryVerse(currentBook, currentChapter - 1, "last");
            break;
          }
          if (currentBookIndex > 0) {
            const prev = orderedBooks[currentBookIndex - 1];
            navigateToBoundaryVerse(prev.name, prev.chapterCount, "last");
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (e.shiftKey) { moveToVerseShift(activeVerse + NAV_GRID_COLS); break; }
          if (activeVerse + NAV_GRID_COLS > verseCount) {
            if (currentChapter < chapterCount) {
              navigateToBoundaryVerse(currentBook, currentChapter + 1, "first");
            } else if (currentBookIndex >= 0 && currentBookIndex < orderedBooks.length - 1) {
              navigateToBoundaryVerse(orderedBooks[currentBookIndex + 1].name, 1, "first");
            }
            break;
          }
          moveToVerse(activeVerse + NAV_GRID_COLS);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (e.shiftKey) { moveToVerseShift(activeVerse - NAV_GRID_COLS); break; }
          if ((focusedVerse ?? activeVerse) <= NAV_GRID_COLS) {
            if (currentChapter > 1) {
              navigateToBoundaryVerse(currentBook, currentChapter - 1, "last");
            } else if (currentBookIndex > 0) {
              const prev = orderedBooks[currentBookIndex - 1];
              navigateToBoundaryVerse(prev.name, prev.chapterCount, "last");
            } else {
              focusSelectedChapter();
            }
            return;
          }
          moveToVerse(activeVerse - NAV_GRID_COLS);
          break;
        case "Enter":
        case " ":
        case "Spacebar":
          e.preventDefault();
          bible.selectSingleVerse(activeVerse);
          if (isProjecting) void bible.updateBibleProjection();
          else void bible.startBibleProjection();
          break;
        case "Escape":
          if (isProjecting) {
            e.preventDefault();
            void bible.stopBibleProjection();
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
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Header row: title + version selector + projection controls */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight shrink-0">
          {t("nav.bible")}
        </h1>

        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Version Selector */}
          {bible.versions.length > 0 && (
            <Select
              value={String(bible.currentVersionId)}
              onValueChange={(val) => bible.setVersion(Number(val))}
            >
              <SelectTrigger className="w-48 sm:w-60 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bible.versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.abbreviation} -- {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Projection settings toggle */}
          <Button
            variant={showSettings ? "outline" : "ghost"}
            size="sm"
            onClick={() => setShowSettings((s) => !s)}
            className="h-8 w-8 p-0"
            title={t("bible.projectionSettings")}
            aria-pressed={showSettings}
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          {/* Project / Stop button */}
          {bible.isProjecting ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={async () => {
                await bible.stopBibleProjection();
              }}
            >
              <Square className="h-3.5 w-3.5" />
              {t("bible.stopProjection")}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="h-8 gap-1.5"
              onClick={async () => {
                await bible.startBibleProjection();
              }}
              disabled={bible.selectedVerses.length === 0}
            >
              <Monitor className="h-3.5 w-3.5" />
              {t("bible.project")}
            </Button>
          )}
        </div>
      </div>

      {bible.isLoadingVersions && (
        <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
      )}

      {/* Main content area */}
      {bible.currentVersionId > 0 && (
        <div className="flex min-h-0 flex-1 gap-3">
          {/* Left panel: Verse reading area */}
          <div className="min-h-0 w-[28%] shrink-0 overflow-y-auto rounded-lg border border-border bg-surface p-3">
            {bible.currentBook && bible.currentChapter > 0 ? (
              <VerseDisplay
                verses={bible.verses}
                selectedVerses={bible.selectedVerses}
                scrollToVerse={bible.lastSelectedVerse}
                book={bible.currentBook}
                chapter={bible.currentChapter}
                versionAbbr={currentVersion?.abbreviation}
                onSelectVerse={handleSelectVerse}
                onDoubleClickVerse={handleDoubleClickVerse}
                isLoading={bible.isLoadingVerses}
                onOpenCompare={bible.versions.length > 1 ? () => setShowComparison(true) : undefined}
                isProjecting={bible.isProjecting}
                onProject={handleProjectFromVerseDisplay}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">
                  {t("bible.selectBook")}
                </p>
              </div>
            )}
          </div>
          
          {/* Center panel: Book/Chapter/Verse grid selector + search */}
          <div className="flex min-h-0 flex-col gap-2 lg:flex-1">
            <BibleSearch
              query={searchQuery}
              onQueryChange={setSearchQuery}
              versionId={bible.currentVersionId}
              versionAbbr={currentVersion?.abbreviation}
              onNavigate={handleSearchNavigate}
              availableBooks={availableBooks}
            />

            {bible.isLoadingBooks ? (
              <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
            ) : (
              <div className="min-h-0 flex-1">
                <BookSelector
                  books={bible.books}
                  currentBook={bible.currentBook}
                  currentChapter={bible.currentChapter}
                  verseCount={bible.verses.length}
                  selectedVerses={bible.selectedVerses}
                  onSelectBook={bible.setBook}
                  onSelectChapter={bible.setChapter}
                  onSelectVerse={handleSelectVerse}
                  onDoubleClickVerse={handleDoubleClickVerse}
                />
              </div>
            )}
          </div>

          {/* Right panel: Projection settings (collapsible) */}
          <div
            className={cn(
              "min-h-0 overflow-y-auto rounded-lg border border-border bg-surface transition-all duration-200",
              showSettings
                ? "w-[260px] shrink-0 p-3 opacity-100"
                : "w-0 overflow-hidden border-0 p-0 opacity-0",
            )}
          >
            {showSettings && (
              <>
                <ProjectionSettings
                  settings={projectionSettings}
                  onChange={updateProjectionSettings}
                />
                <Link
                  to="/settings"
                  className="mt-3 block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("bible.manageInSettings")} &rarr;
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Version comparison dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("bible.comparison")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <VersionComparison
              currentVersionId={bible.currentVersionId}
              book={bible.currentBook}
              chapter={bible.currentChapter}
              selectedVerses={bible.selectedVerses}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
