import { useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { Book } from "../../types/bible";
import {
  type BookCategory,
  PERIODIC_BOOKS,
  getLocalizedBookNameByIndex,
  resolveBookIndex,
} from "./book-catalog";

const CATEGORY_COLORS: Record<BookCategory, string> = {
  pentateuch: "bg-rose-900",
  historical: "bg-amber-700",
  poetic: "bg-yellow-600",
  majorProphets: "bg-emerald-800",
  minorProphets: "bg-teal-600",
  gospels: "bg-blue-700",
  acts: "bg-sky-700",
  pauline: "bg-red-700",
  generalEpistles: "bg-violet-700",
  revelation: "bg-fuchsia-800",
};

const CATEGORY_HOVER: Record<BookCategory, string> = {
  pentateuch: "hover:bg-rose-800",
  historical: "hover:bg-amber-600",
  poetic: "hover:bg-yellow-500",
  majorProphets: "hover:bg-emerald-700",
  minorProphets: "hover:bg-teal-500",
  gospels: "hover:bg-blue-600",
  acts: "hover:bg-sky-600",
  pauline: "hover:bg-red-600",
  generalEpistles: "hover:bg-violet-600",
  revelation: "hover:bg-fuchsia-700",
};

interface BookSelectorProps {
  books: Book[];
  currentBook: string;
  currentChapter: number;
  verseCount: number;
  selectedVerses: number[];
  onSelectBook: (book: string) => void;
  onSelectChapter: (chapter: number) => void;
  onSelectVerse: (verse: number) => void;
  onDoubleClickVerse: (verse: number) => void;
}

export function BookSelector({
  books,
  currentBook,
  currentChapter,
  verseCount,
  selectedVerses,
  onSelectBook,
  onSelectChapter,
  onSelectVerse,
  onDoubleClickVerse,
}: BookSelectorProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const chapterRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const verseRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const availableBooks = useMemo(() => {
    const map = new Map<number, { sourceName: string; chapterCount: number }>();
    for (const b of books) {
      const index = resolveBookIndex(b.name);
      if (index === null || map.has(index)) continue;
      map.set(index, { sourceName: b.name, chapterCount: b.chapterCount });
    }
    return map;
  }, [books]);

  const selectedBookIndex = resolveBookIndex(currentBook);
  const selectedEntry = selectedBookIndex !== null ? PERIODIC_BOOKS[selectedBookIndex] : null;
  const chapterCount = selectedBookIndex !== null ? (availableBooks.get(selectedBookIndex)?.chapterCount ?? 0) : 0;
  const localizedCurrentBook = selectedBookIndex !== null
    ? getLocalizedBookNameByIndex(selectedBookIndex, language)
    : currentBook;
  const selectedVerseTail = selectedVerses[selectedVerses.length - 1] ?? null;

  const setChapterRef = useCallback((chapter: number, el: HTMLButtonElement | null) => {
    if (el) {
      chapterRefs.current.set(chapter, el);
      return;
    }
    chapterRefs.current.delete(chapter);
  }, []);

  const setVerseRef = useCallback((verse: number, el: HTMLButtonElement | null) => {
    if (el) {
      verseRefs.current.set(verse, el);
      return;
    }
    verseRefs.current.delete(verse);
  }, []);

  useEffect(() => {
    if (!currentBook || chapterCount <= 0) return;
    const targetChapter = currentChapter > 0 ? Math.min(currentChapter, chapterCount) : 1;
    chapterRefs.current.get(targetChapter)?.focus();
  }, [currentBook, currentChapter, chapterCount]);

  useEffect(() => {
    if (!currentBook || currentChapter <= 0 || verseCount <= 0) return;
    const targetVerse = selectedVerseTail !== null
      ? Math.min(selectedVerseTail, verseCount)
      : 1;
    verseRefs.current.get(targetVerse)?.focus();
  }, [currentBook, currentChapter, verseCount, selectedVerseTail]);

  return (
    <div className="space-y-3">
      {/* Periodic Table Grid */}
      <div className="overflow-x-auto py-1">
        <div className="grid min-w-[640px] grid-cols-11 gap-[3px] px-1">
          {PERIODIC_BOOKS.map((book, index) => {
            const availableEntry = availableBooks.get(index);
            const available = Boolean(availableEntry);
            const selected = index === selectedBookIndex;
            const localizedName = getLocalizedBookNameByIndex(index, language);

            return (
              <button
                key={book.abbr}
                data-bible-grid="book"
                data-book-index={index}
                data-selected={selected ? "true" : undefined}
                disabled={!available}
                onClick={() => {
                  if (availableEntry) {
                    onSelectBook(availableEntry.sourceName);
                  }
                }}
                title={localizedName}
                className={cn(
                  "flex flex-col items-center justify-center rounded-sm px-0.5 py-1.5 text-white transition-all",
                  CATEGORY_COLORS[book.cat],
                  available && CATEGORY_HOVER[book.cat],
                  !available && "cursor-not-allowed opacity-20",
                  selected && "z-10 ring-2 ring-white shadow-lg",
                )}
              >
                <span className="text-sm font-bold leading-none">{book.abbr}</span>
                <span className="mt-0.5 w-full truncate text-center text-[7px] leading-none opacity-80">
                  {localizedName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapter Grid — always visible when a book is selected */}
      {currentBook && chapterCount > 0 && (
        <div className="overflow-x-auto pt-1">
          <div className="grid min-w-[640px] grid-cols-11 gap-[3px]">
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map((ch) => {
              const isSelected = ch === currentChapter;
              return (
                <button
                  key={ch}
                  data-bible-grid="chapter"
                  data-chapter={ch}
                  data-selected={isSelected ? "true" : undefined}
                  ref={(el) => setChapterRef(ch, el)}
                  onClick={() => onSelectChapter(ch)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-sm text-sm font-semibold transition-colors",
                    isSelected && selectedEntry
                      ? `text-white ${CATEGORY_COLORS[selectedEntry.cat]}`
                      : "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Verse Grid — visible when a chapter is selected */}
      {currentBook && currentChapter > 0 && verseCount > 0 && (
        <div className="overflow-x-auto pt-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {localizedCurrentBook} {currentChapter} — {t("bible.verses")}
          </p>
          <div className="grid min-w-[640px] grid-cols-11 gap-[3px]">
            {Array.from({ length: verseCount }, (_, i) => i + 1).map((v) => {
              const isSelected = selectedVerses.includes(v);
              return (
                <button
                  key={v}
                  data-bible-grid="verse"
                  data-verse={v}
                  data-selected={isSelected ? "true" : undefined}
                  ref={(el) => setVerseRef(v, el)}
                  onClick={() => onSelectVerse(v)}
                  onDoubleClick={() => onDoubleClickVerse(v)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-sm text-xs font-medium transition-colors",
                    isSelected && selectedEntry
                      ? `text-white ${CATEGORY_COLORS[selectedEntry.cat]}`
                      : "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
