import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useBible } from "../../hooks/use-bible";
import { BookSelector } from "../../components/bible/book-selector";
import { VerseDisplay } from "../../components/bible/verse-display";
import { BibleSearch } from "../../components/bible/bible-search";
import { VersionComparison } from "../../components/bible/version-comparison";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";

const VERSE_GRID_COLUMNS = 11;

export const Route = createFileRoute("/bible/")({
  component: BibleIndex,
  validateSearch: (search: Record<string, unknown>) => ({
    book: (search.book as string) || undefined,
    chapter: search.chapter ? Number(search.chapter) : undefined,
    verse: search.verse ? Number(search.verse) : undefined,
  }),
});

function BibleIndex() {
  const { t } = useTranslation();
  const bible = useBible();
  const { book, chapter, verse } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const deepLinkApplied = useRef(false);

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

  const handleSearchNavigate = (book: string, chapter: number, verse: number) => {
    setSearchQuery("");
    bible.setBook(book);
    bible.setChapter(chapter);
    bible.selectVerse(verse);
  };

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

      const { currentBook, currentChapter, verses, lastSelectedVerse, selectedVerses } = bible;
      if (!currentBook || currentChapter <= 0 || verses.length === 0) return;

      const verseCount = verses.length;
      const selectedTail = selectedVerses[selectedVerses.length - 1];
      const clampedLast = lastSelectedVerse && lastSelectedVerse > 0
        ? Math.min(lastSelectedVerse, verseCount)
        : null;
      const activeVerse = clampedLast && selectedVerses.includes(clampedLast)
        ? clampedLast
        : selectedTail
          ? Math.min(selectedTail, verseCount)
          : null;

      const moveToVerse = (verse: number) => {
        const clamped = Math.max(1, Math.min(verse, verseCount));
        bible.selectSingleVerse(clamped);
      };

      switch (e.key) {
        case "ArrowRight":
          if (activeVerse === null) return;
          e.preventDefault();
          moveToVerse(activeVerse + 1);
          break;
        case "ArrowLeft":
          if (activeVerse === null) return;
          e.preventDefault();
          moveToVerse(activeVerse - 1);
          break;
        case "ArrowDown":
          if (activeVerse === null) return;
          e.preventDefault();
          moveToVerse(activeVerse + VERSE_GRID_COLUMNS);
          break;
        case "ArrowUp":
          if (activeVerse === null) return;
          e.preventDefault();
          moveToVerse(activeVerse - VERSE_GRID_COLUMNS);
          break;
        case "Enter":
        case " ":
        case "Spacebar":
          e.preventDefault();
          if (activeVerse !== null) {
            void bible.projectVerse(activeVerse);
          }
          break;
      }
    },
    [bible],
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
        {bible.versions.length > 0 && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
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
                  onDoubleClickVerse={bible.projectVerse}
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
                onDoubleClickVerse={bible.projectVerse}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
