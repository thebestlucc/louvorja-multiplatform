import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MonitorOff } from "lucide-react";
import { useBible } from "../../hooks/use-bible";
import { useMonitorsControl } from "../../hooks/use-monitors";
import { BookSelector, PERIODIC_BOOKS } from "../../components/bible/book-selector";
import { VerseDisplay } from "../../components/bible/verse-display";
import { BibleSearch } from "../../components/bible/bible-search";
import { VersionComparison } from "../../components/bible/version-comparison";
import { Button } from "../../components/ui/button";

export const Route = createFileRoute("/bible/")({
  component: BibleIndex,
});

function BibleIndex() {
  const { t } = useTranslation();
  const bible = useBible();
  const { isProjectorOpen, closeProjector } = useMonitorsControl();
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-select first version when loaded
  useEffect(() => {
    if (bible.versions.length > 0 && !bible.currentVersionId) {
      bible.setVersion(bible.versions[0].id);
    }
  }, [bible.versions, bible.currentVersionId, bible.setVersion]);

  const currentVersion = bible.versions.find((v) => v.id === bible.currentVersionId);
  const availableBooks = useMemo(() => new Set(bible.books.map((b) => b.name)), [bible.books]);
  const availableBooksArray = useMemo(
    () => PERIODIC_BOOKS.filter((b) => availableBooks.has(b.name)).map((b) => b.name),
    [availableBooks],
  );

  const handleSearchNavigate = (book: string, chapter: number, verse: number) => {
    setSearchQuery("");
    bible.setBook(book);
    bible.setChapter(chapter);
    bible.selectVerse(verse);
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { currentBook, currentChapter, verses } = bible;
      const bookIdx = availableBooksArray.indexOf(currentBook);

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          if (isProjectorOpen) {
            closeProjector();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentBook && currentChapter > 0) {
            // Next chapter
            const book = bible.books.find((b) => b.name === currentBook);
            if (book && currentChapter < book.chapterCount) {
              bible.setChapter(currentChapter + 1);
            } else if (bookIdx >= 0 && bookIdx < availableBooksArray.length - 1) {
              // Next book, chapter 1
              bible.setBook(availableBooksArray[bookIdx + 1]);
              bible.setChapter(1);
            }
          } else if (currentBook && currentChapter === 0) {
            bible.setChapter(1);
          } else if (!currentBook && availableBooksArray.length > 0) {
            bible.setBook(availableBooksArray[0]);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentBook && currentChapter > 1) {
            bible.setChapter(currentChapter - 1);
          } else if (currentBook && currentChapter <= 1 && bookIdx > 0) {
            const prevBook = availableBooksArray[bookIdx - 1];
            bible.setBook(prevBook);
            const prev = bible.books.find((b) => b.name === prevBook);
            if (prev) bible.setChapter(prev.chapterCount);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (currentBook && currentChapter > 0 && verses.length > 0) {
            // Select next verse
            const selected = bible.selectedVerses;
            const last = selected.length > 0 ? Math.max(...selected) : 0;
            if (last < verses.length) {
              bible.selectVerse(last + 1);
            }
          } else if (bookIdx >= 0 && bookIdx + 11 < availableBooksArray.length) {
            bible.setBook(availableBooksArray[bookIdx + 11]);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentBook && currentChapter > 0 && bible.selectedVerses.length > 0) {
            // Deselect last selected verse
            const last = Math.max(...bible.selectedVerses);
            bible.selectVerse(last);
          } else if (bookIdx >= 11) {
            bible.setBook(availableBooksArray[bookIdx - 11]);
          }
          break;
        case "Enter":
          e.preventDefault();
          if (bible.selectedVerses.length > 0) {
            bible.projectSelectedVerses();
          }
          break;
      }
    },
    [bible, availableBooksArray, isProjectorOpen, closeProjector],
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
            <div className="flex gap-1">
              {bible.versions.map((v) => (
                <Button
                  key={v.id}
                  variant={v.id === bible.currentVersionId ? "default" : "outline"}
                  size="sm"
                  onClick={() => bible.setVersion(v.id)}
                >
                  {v.abbreviation}
                </Button>
              ))}
            </div>
          )}
          {isProjectorOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={closeProjector}
              title="Fechar projetor (ESC)"
            >
              <MonitorOff className="mr-1.5 h-3.5 w-3.5" />
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
                  onDoubleClickVerse={bible.projectVerse}
                  onProjectSelected={bible.projectSelectedVerses}
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
