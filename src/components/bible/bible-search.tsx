import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBibleSearch } from "../../lib/queries";
import { Input } from "../ui/input";
import { Search, X, BookOpen, ArrowRight } from "lucide-react";
import { PERIODIC_BOOKS } from "./book-selector";
import type { BibleSearchResult } from "../../types/bible";

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface ParsedReference {
  bookName: string;
  chapter?: number;
  verse?: number;
}

function parseReference(query: string): ParsedReference | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Match patterns like "Gn 1:3", "Genesis 1", "1 Sm 3:5", "1Sm 3"
  const match = trimmed.match(
    /^(\d?\s*[a-zA-Z\u00C0-\u017F]+)\s+(\d+)(?::(\d+))?$/,
  );
  if (!match) return null;

  const bookQuery = stripAccents(match[1].replace(/\s+/g, " ").trim());
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : undefined;

  // Find matching book by abbreviation or name prefix
  const found = PERIODIC_BOOKS.find(
    (b) =>
      stripAccents(b.abbr) === bookQuery ||
      stripAccents(b.name).startsWith(bookQuery),
  );

  if (!found) return null;
  return { bookName: found.name, chapter, verse };
}

interface BibleSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  versionId: number | null;
  onNavigate: (book: string, chapter: number, verse: number) => void;
  availableBooks: Set<string>;
}

export function BibleSearch({
  query,
  onQueryChange,
  versionId,
  onNavigate,
  availableBooks,
}: BibleSearchProps) {
  const { t } = useTranslation();

  // Debounce the text query for backend search (300ms)
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: textResults, isLoading } = useBibleSearch(debouncedQuery, versionId);

  // Local: instant book name / abbreviation matching
  const bookMatches = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [];
    const normalized = stripAccents(q);
    return PERIODIC_BOOKS.filter(
      (b) =>
        availableBooks.has(b.name) &&
        (stripAccents(b.abbr).startsWith(normalized) ||
          stripAccents(b.name).startsWith(normalized)),
    ).slice(0, 5);
  }, [query, availableBooks]);

  // Local: instant reference parsing (e.g. "Gn 1:3")
  const parsedRef = useMemo(() => {
    const ref = parseReference(query);
    if (ref && availableBooks.has(ref.bookName)) return ref;
    return null;
  }, [query, availableBooks]);

  // Group text search results by book + chapter
  const grouped = useMemo(() => {
    if (!textResults) return new Map<string, BibleSearchResult[]>();
    const map = new Map<string, BibleSearchResult[]>();
    for (const r of textResults) {
      const key = `${r.verse.book} ${r.verse.chapter}`;
      const group = map.get(key) ?? [];
      group.push(r);
      map.set(key, group);
    }
    return map;
  }, [textResults]);

  const showDropdown =
    query.trim().length >= 1 &&
    (bookMatches.length > 0 ||
      parsedRef !== null ||
      (query.trim().length >= 2 && (isLoading || (textResults && textResults.length > 0))) ||
      (query.trim().length >= 2 && textResults && textResults.length === 0 && !isLoading));

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("bible.searchPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl">
          {/* Reference match (e.g. "Gn 1:3") */}
          {parsedRef && (
            <button
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm hover:bg-accent"
              onClick={() =>
                onNavigate(
                  parsedRef.bookName,
                  parsedRef.chapter ?? 1,
                  parsedRef.verse ?? 1,
                )
              }
            >
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="font-medium">
                {parsedRef.bookName} {parsedRef.chapter}
                {parsedRef.verse ? `:${parsedRef.verse}` : ""}
              </span>
            </button>
          )}

          {/* Book name matches */}
          {bookMatches.length > 0 && !parsedRef && (
            <div className="border-b border-border p-1">
              {bookMatches.map((b) => (
                <button
                  key={b.abbr}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onNavigate(b.name, 1, 1)}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{b.abbr}</span>
                    <span className="ml-1.5 text-muted-foreground">{b.name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Text search loading */}
          {isLoading && query.trim().length >= 2 && (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">{t("bible.loading")}</p>
          )}

          {/* Text search results */}
          {grouped.size > 0 && (
            <div className="p-1">
              {Array.from(grouped.entries()).map(([key, items]) => (
                <div key={key}>
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {key}
                  </p>
                  {items.map((r) => (
                    <button
                      key={r.verse.id}
                      className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() =>
                        onNavigate(r.verse.book, r.verse.chapter, r.verse.verse)
                      }
                    >
                      <span className="font-medium">v.{r.verse.verse}</span>{" "}
                      <span
                        className="text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: r.snippet }}
                      />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 2 &&
            !isLoading &&
            textResults &&
            textResults.length === 0 &&
            bookMatches.length === 0 &&
            !parsedRef && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {t("bible.noResults")}
              </p>
            )}
        </div>
      )}
    </div>
  );
}
