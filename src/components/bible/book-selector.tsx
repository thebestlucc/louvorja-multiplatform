import { useMemo } from "react";
import { cn } from "../../lib/utils";
import type { Book } from "../../types/bible";

type BookCategory =
  | "pentateuch"
  | "historical"
  | "poetic"
  | "majorProphets"
  | "minorProphets"
  | "gospels"
  | "acts"
  | "pauline"
  | "generalEpistles"
  | "revelation";

interface PeriodicBook {
  abbr: string;
  name: string;
  cat: BookCategory;
}

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

export type { PeriodicBook };

// 66 books arranged in 6 rows × 11 columns (periodic table layout)
export const PERIODIC_BOOKS: PeriodicBook[] = [
  // Row 1: Pentateuch (5) + Historical (6)
  { abbr: "Gn", name: "Gênesis", cat: "pentateuch" },
  { abbr: "Êx", name: "Êxodo", cat: "pentateuch" },
  { abbr: "Lv", name: "Levítico", cat: "pentateuch" },
  { abbr: "Nm", name: "Números", cat: "pentateuch" },
  { abbr: "Dt", name: "Deuteronômio", cat: "pentateuch" },
  { abbr: "Js", name: "Josué", cat: "historical" },
  { abbr: "Jz", name: "Juízes", cat: "historical" },
  { abbr: "Rt", name: "Rute", cat: "historical" },
  { abbr: "1Sm", name: "1 Samuel", cat: "historical" },
  { abbr: "2Sm", name: "2 Samuel", cat: "historical" },
  { abbr: "1Rs", name: "1 Reis", cat: "historical" },
  // Row 2: Historical (6) + Poetic (5)
  { abbr: "2Rs", name: "2 Reis", cat: "historical" },
  { abbr: "1Cr", name: "1 Crônicas", cat: "historical" },
  { abbr: "2Cr", name: "2 Crônicas", cat: "historical" },
  { abbr: "Ed", name: "Esdras", cat: "historical" },
  { abbr: "Ne", name: "Neemias", cat: "historical" },
  { abbr: "Et", name: "Ester", cat: "historical" },
  { abbr: "Jó", name: "Jó", cat: "poetic" },
  { abbr: "Sl", name: "Salmos", cat: "poetic" },
  { abbr: "Pv", name: "Provérbios", cat: "poetic" },
  { abbr: "Ec", name: "Eclesiastes", cat: "poetic" },
  { abbr: "Ct", name: "Cantares", cat: "poetic" },
  // Row 3: Major Prophets (5) + Minor Prophets (6)
  { abbr: "Is", name: "Isaías", cat: "majorProphets" },
  { abbr: "Jr", name: "Jeremias", cat: "majorProphets" },
  { abbr: "Lm", name: "Lamentações", cat: "majorProphets" },
  { abbr: "Ez", name: "Ezequiel", cat: "majorProphets" },
  { abbr: "Dn", name: "Daniel", cat: "majorProphets" },
  { abbr: "Os", name: "Oséias", cat: "minorProphets" },
  { abbr: "Jl", name: "Joel", cat: "minorProphets" },
  { abbr: "Am", name: "Amós", cat: "minorProphets" },
  { abbr: "Ob", name: "Obadias", cat: "minorProphets" },
  { abbr: "Jn", name: "Jonas", cat: "minorProphets" },
  { abbr: "Mq", name: "Miquéias", cat: "minorProphets" },
  // Row 4: Minor Prophets (6) + Gospels (4) + Acts (1)
  { abbr: "Na", name: "Naum", cat: "minorProphets" },
  { abbr: "Hc", name: "Habacuque", cat: "minorProphets" },
  { abbr: "Sf", name: "Sofonias", cat: "minorProphets" },
  { abbr: "Ag", name: "Ageu", cat: "minorProphets" },
  { abbr: "Zc", name: "Zacarias", cat: "minorProphets" },
  { abbr: "Ml", name: "Malaquias", cat: "minorProphets" },
  { abbr: "Mt", name: "Mateus", cat: "gospels" },
  { abbr: "Mc", name: "Marcos", cat: "gospels" },
  { abbr: "Lc", name: "Lucas", cat: "gospels" },
  { abbr: "Jo", name: "João", cat: "gospels" },
  { abbr: "At", name: "Atos", cat: "acts" },
  // Row 5: Pauline Epistles (11)
  { abbr: "Rm", name: "Romanos", cat: "pauline" },
  { abbr: "1Co", name: "1 Coríntios", cat: "pauline" },
  { abbr: "2Co", name: "2 Coríntios", cat: "pauline" },
  { abbr: "Gl", name: "Gálatas", cat: "pauline" },
  { abbr: "Ef", name: "Efésios", cat: "pauline" },
  { abbr: "Fp", name: "Filipenses", cat: "pauline" },
  { abbr: "Cl", name: "Colossenses", cat: "pauline" },
  { abbr: "1Ts", name: "1 Tessalonicenses", cat: "pauline" },
  { abbr: "2Ts", name: "2 Tessalonicenses", cat: "pauline" },
  { abbr: "1Tm", name: "1 Timóteo", cat: "pauline" },
  { abbr: "2Tm", name: "2 Timóteo", cat: "pauline" },
  // Row 6: Pauline (2) + General Epistles (8) + Revelation (1)
  { abbr: "Tt", name: "Tito", cat: "pauline" },
  { abbr: "Fm", name: "Filemom", cat: "pauline" },
  { abbr: "Hb", name: "Hebreus", cat: "generalEpistles" },
  { abbr: "Tg", name: "Tiago", cat: "generalEpistles" },
  { abbr: "1Pe", name: "1 Pedro", cat: "generalEpistles" },
  { abbr: "2Pe", name: "2 Pedro", cat: "generalEpistles" },
  { abbr: "1Jo", name: "1 João", cat: "generalEpistles" },
  { abbr: "2Jo", name: "2 João", cat: "generalEpistles" },
  { abbr: "3Jo", name: "3 João", cat: "generalEpistles" },
  { abbr: "Jd", name: "Judas", cat: "generalEpistles" },
  { abbr: "Ap", name: "Apocalipse", cat: "revelation" },
];

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
  const availableBooks = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of books) map.set(b.name, b.chapterCount);
    return map;
  }, [books]);

  const selectedEntry = PERIODIC_BOOKS.find((b) => b.name === currentBook);
  const chapterCount = currentBook ? (availableBooks.get(currentBook) ?? 0) : 0;

  return (
    <div className="space-y-3">
      {/* Periodic Table Grid */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-11 gap-[3px]">
          {PERIODIC_BOOKS.map((book) => {
            const available = availableBooks.has(book.name);
            const selected = book.name === currentBook;
            return (
              <button
                key={book.abbr}
                disabled={!available}
                onClick={() => onSelectBook(book.name)}
                title={book.name}
                className={cn(
                  "flex flex-col items-center justify-center rounded-sm px-0.5 py-1.5 text-white transition-all",
                  CATEGORY_COLORS[book.cat],
                  available && CATEGORY_HOVER[book.cat],
                  !available && "opacity-20 cursor-not-allowed",
                  selected && "ring-2 ring-white shadow-lg scale-[1.08] z-10",
                )}
              >
                <span className="text-sm font-bold leading-none">{book.abbr}</span>
                <span className="mt-0.5 w-full truncate text-center text-[7px] leading-none opacity-80">
                  {book.name}
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
            {currentBook} {currentChapter} — Versículos
          </p>
          <div className="grid min-w-[640px] grid-cols-11 gap-[3px]">
            {Array.from({ length: verseCount }, (_, i) => i + 1).map((v) => {
              const isSelected = selectedVerses.includes(v);
              return (
                <button
                  key={v}
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
