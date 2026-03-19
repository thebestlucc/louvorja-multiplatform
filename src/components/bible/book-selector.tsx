import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
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

// 6 cols × 5 rows = 30 total slots; slots 0 and 29 reserved for nav cells
export const NAV_GRID_COLS = 6;
const GRID_COLS = NAV_GRID_COLS;
const GRID_ROWS = 5;
const TOTAL_SLOTS = GRID_COLS * GRID_ROWS; // 30
const ITEMS_PER_PAGE = TOTAL_SLOTS - 2; // 28

export const BOOK_COLS = 11;
const BOOK_ROWS = Math.ceil(PERIODIC_BOOKS.length / BOOK_COLS); // 6

interface BookSelectorProps {
  books: Book[];
  currentBook: string;
  currentChapter: number;
  verseCount: number;
  selectedVerses: number[];
  onSelectBook: (book: string) => void;
  onSelectChapter: (chapter: number) => void;
  onSelectVerse: (verse: number, shiftKey?: boolean) => void;
  onDoubleClickVerse: (verse: number) => void;
}

interface NavGridProps {
  total: number;
  page: number;
  onPageChange: (p: number) => void;
  renderCell: (num: number) => React.ReactNode;
  emptyLabel: string;
  "data-grid-type": string;
}

function NavGrid({
  total,
  page,
  onPageChange,
  renderCell,
  emptyLabel,
  "data-grid-type": gridType,
}: NavGridProps) {
  if (total <= 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[10px] text-muted-foreground/50">{emptyLabel}</span>
      </div>
    );
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const start = page * ITEMS_PER_PAGE + 1; // 1-indexed
  const end = Math.min(start + ITEMS_PER_PAGE - 1, total);

  const slots: React.ReactNode[] = [];

  // Slot 0: prev nav or spacer
  slots.push(
    hasPrev ? (
      <button
        key="prev-nav"
        onClick={() => onPageChange(page - 1)}
        className="flex cursor-pointer items-center justify-center rounded-sm bg-accent/60 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronsLeft className="h-3 w-3" />
      </button>
    ) : (
      <div key="prev-empty" />
    ),
  );

  // Slots 1–28: items (28 items per page)
  for (let num = start; num <= end; num++) {
    slots.push(renderCell(num));
  }

  // Pad with empty divs when items < ITEMS_PER_PAGE
  const itemsShown = end - start + 1;
  for (let i = itemsShown; i < ITEMS_PER_PAGE; i++) {
    slots.push(<div key={`pad-${i}`} />);
  }

  // Slot 29: next nav or spacer
  slots.push(
    hasNext ? (
      <button
        key="next-nav"
        onClick={() => onPageChange(page + 1)}
        className="flex cursor-pointer items-center justify-center rounded-sm bg-accent/60 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronsRight className="h-3 w-3" />
      </button>
    ) : (
      <div key="next-empty" />
    ),
  );

  return (
    <div
      data-grid-type={gridType}
      className="grid h-full gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
      }}
    >
      {slots}
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
  const chapterCount =
    selectedBookIndex !== null ? (availableBooks.get(selectedBookIndex)?.chapterCount ?? 0) : 0;
  const localizedCurrentBook =
    selectedBookIndex !== null
      ? getLocalizedBookNameByIndex(selectedBookIndex, language)
      : currentBook;
  const selectedVerseTail = selectedVerses[selectedVerses.length - 1] ?? null;

  // Auto-follow page when selection changes
  useEffect(() => {
    if (currentChapter > 0) {
      setChapterPage(Math.floor((currentChapter - 1) / ITEMS_PER_PAGE));
    }
  }, [currentChapter]);

  useEffect(() => {
    setVersePage(0);
  }, [currentChapter]);

  useEffect(() => {
    if (selectedVerseTail !== null) {
      setVersePage(Math.floor((selectedVerseTail - 1) / ITEMS_PER_PAGE));
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
    const active = document.activeElement;
    const isChapterFocused = active instanceof HTMLElement && active.dataset.bibleGrid === "chapter";
    if (!isChapterFocused) return;
    const target = currentChapter > 0 ? Math.min(currentChapter, chapterCount) : 1;
    chapterRefs.current.get(target)?.focus();
  }, [currentBook, currentChapter, chapterCount]);

  useEffect(() => {
    if (!currentBook || currentChapter <= 0 || verseCount <= 0) return;
    const active = document.activeElement;
    const isVerseFocused = active instanceof HTMLElement && active.dataset.bibleGrid === "verse";
    if (!isVerseFocused) return;
    const target = selectedVerseTail !== null ? Math.min(selectedVerseTail, verseCount) : 1;
    verseRefs.current.get(target)?.focus();
  }, [currentBook, currentChapter, verseCount, selectedVerseTail]);

  const selectedVerseSet = new Set(selectedVerses);

  const chapterLabel = selectedEntry
    ? CATEGORY_COLORS[selectedEntry.cat]
    : "bg-primary";

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Books — top 50% */}
      <div className="min-h-0 flex-1">
        <div
          className="grid h-full gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${BOOK_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${BOOK_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {PERIODIC_BOOKS.map((book, index) => {
            const availableEntry = availableBooks.get(index);
            const available = Boolean(availableEntry);
            const selected = index === selectedBookIndex;
            const hasSelection = selectedBookIndex !== null;
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
                  "flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-sm p-[3px] text-white transition-all",
                  CATEGORY_COLORS[book.cat],
                  available && [CATEGORY_HOVER[book.cat], "cursor-pointer"],
                  !available && "cursor-not-allowed opacity-20",
                  selected && "z-10 ring-2 ring-white shadow-lg",
                  hasSelection && !selected && available && "opacity-50 saturate-50",
                )}
              >
                <span className="text-[11px] font-extrabold leading-none">{book.abbr}</span>
                <span className="w-full truncate text-center text-[7px] leading-none opacity-80">
                  {localizedName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Chapters (left) + Verses (right) — each 50% width, flex-1 height */}
      <div className="flex min-h-0 flex-1 gap-1">
        {/* Chapters */}
        <div className="flex min-h-0 w-1/2 flex-col gap-0.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("bible.chapters")}
          </span>
          <div className="min-h-0 flex-1">
            <NavGrid
              total={chapterCount}
              page={chapterPage}
              onPageChange={setChapterPage}
              emptyLabel={t("bible.selectBook")}
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
                      "flex cursor-pointer items-center justify-center rounded-sm text-xs font-semibold transition-colors",
                      isSelected && selectedEntry
                        ? `text-white ${chapterLabel}`
                        : "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {ch}
                  </button>
                );
              }}
            />
          </div>
        </div>

        {/* Verses */}
        <div className="flex min-h-0 w-1/2 flex-col gap-0.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {localizedCurrentBook && currentChapter > 0
              ? `${localizedCurrentBook} ${currentChapter}`
              : t("bible.verses")}
          </span>
          <div className="min-h-0 flex-1">
            <NavGrid
              total={verseCount}
              page={versePage}
              onPageChange={setVersePage}
              emptyLabel={t("bible.selectChapter")}
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
                    onClick={(ev) => onSelectVerse(v, ev.shiftKey)}
                    onDoubleClick={() => onDoubleClickVerse(v)}
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-sm text-xs font-medium transition-colors",
                      isSelected && selectedEntry
                        ? `text-white ${chapterLabel}`
                        : "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {v}
                  </button>
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
