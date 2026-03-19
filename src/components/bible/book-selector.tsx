import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

// Grid constants — 9 cols × 5 rows = 45 items per page for chapters/verses
const NAV_COLS = 9;
const NAV_ROWS = 5;
const NAV_PAGE_SIZE = NAV_COLS * NAV_ROWS;

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

interface PaginatedGridProps {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  /** Render a single cell by 1-based number */
  renderCell: (num: number) => React.ReactNode;
  label: string;
  "data-grid-type": string;
}

function PaginatedGrid({ total, page, onPageChange, renderCell, label, "data-grid-type": gridType }: PaginatedGridProps) {
  const totalPages = Math.ceil(total / NAV_PAGE_SIZE);
  const start = page * NAV_PAGE_SIZE + 1;
  const end = Math.min(start + NAV_PAGE_SIZE - 1, total);
  const items = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex flex-col gap-1">
      {/* Section header + pagination controls */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[3rem] text-center text-[10px] text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Grid — fills full width, square cells, fixed columns */}
      <div
        data-grid-type={gridType}
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${NAV_COLS}, minmax(0, 1fr))` }}
      >
        {items.map((num) => renderCell(num))}
      </div>
    </div>
  );
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

  const [chapterPage, setChapterPage] = useState(0);
  const [versePage, setVersePage] = useState(0);

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

  // Auto-follow page when selection changes
  useEffect(() => {
    if (currentChapter > 0) {
      setChapterPage(Math.floor((currentChapter - 1) / NAV_PAGE_SIZE));
    }
  }, [currentChapter]);

  useEffect(() => {
    setVersePage(0);
  }, [currentChapter]);

  useEffect(() => {
    if (selectedVerseTail !== null) {
      setVersePage(Math.floor((selectedVerseTail - 1) / NAV_PAGE_SIZE));
    }
  }, [selectedVerseTail]);

  const setChapterRef = useCallback((chapter: number, el: HTMLButtonElement | null) => {
    if (el) chapterRefs.current.set(chapter, el);
    else chapterRefs.current.delete(chapter);
  }, []);

  const setVerseRef = useCallback((verse: number, el: HTMLButtonElement | null) => {
    if (el) verseRefs.current.set(verse, el);
    else verseRefs.current.delete(verse);
  }, []);

  useEffect(() => {
    if (!currentBook || chapterCount <= 0) return;
    const targetChapter = currentChapter > 0 ? Math.min(currentChapter, chapterCount) : 1;
    chapterRefs.current.get(targetChapter)?.focus();
  }, [currentBook, currentChapter, chapterCount]);

  useEffect(() => {
    if (!currentBook || currentChapter <= 0 || verseCount <= 0) return;
    const targetVerse = selectedVerseTail !== null ? Math.min(selectedVerseTail, verseCount) : 1;
    verseRefs.current.get(targetVerse)?.focus();
  }, [currentBook, currentChapter, verseCount, selectedVerseTail]);

  const selectedVerseSet = new Set(selectedVerses);

  return (
    <div className="space-y-3">
      {/* Periodic Table Grid — 11 columns, square cells */}
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(11, minmax(0, 1fr))" }}>
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
                if (availableEntry) onSelectBook(availableEntry.sourceName);
              }}
              title={localizedName}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-sm text-white transition-all",
                CATEGORY_COLORS[book.cat],
                available && CATEGORY_HOVER[book.cat],
                !available && "cursor-not-allowed opacity-20",
                selected && "z-10 ring-2 ring-white shadow-lg",
              )}
            >
              <span className="text-xs font-bold leading-none sm:text-sm">{book.abbr}</span>
              <span className="mt-0.5 w-full truncate px-0.5 text-center text-[6px] leading-none opacity-80 sm:text-[7px]">
                {localizedName}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chapter Grid — paginated, square cells */}
      {currentBook && chapterCount > 0 && (
        <PaginatedGrid
          total={chapterCount}
          page={chapterPage}
          onPageChange={setChapterPage}
          label={t("bible.chapters")}
          data-grid-type="chapter"
          renderCell={(ch) => {
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
                  "flex aspect-square items-center justify-center rounded-sm text-sm font-semibold transition-colors",
                  isSelected && selectedEntry
                    ? `text-white ${CATEGORY_COLORS[selectedEntry.cat]}`
                    : "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {ch}
              </button>
            );
          }}
        />
      )}

      {/* Verse Grid — paginated, square cells */}
      {currentBook && currentChapter > 0 && verseCount > 0 && (
        <PaginatedGrid
          total={verseCount}
          page={versePage}
          onPageChange={setVersePage}
          label={`${localizedCurrentBook} ${currentChapter} — ${t("bible.verses")}`}
          data-grid-type="verse"
          renderCell={(v) => {
            const isSelected = selectedVerseSet.has(v);
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
                  "flex aspect-square items-center justify-center rounded-sm text-sm font-medium transition-colors",
                  isSelected && selectedEntry
                    ? `text-white ${CATEGORY_COLORS[selectedEntry.cat]}`
                    : "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {v}
              </button>
            );
          }}
        />
      )}
    </div>
  );
}
