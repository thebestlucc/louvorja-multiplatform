import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBibleSearch } from "../../lib/queries";
import { Input } from "../ui/input";
import { Search, X, BookOpen, ArrowRight } from "lucide-react";
import type { BibleSearchResult } from "../../types/bible";
import {
  findBookIndexByQuery,
  getLocalizedBookAbbrByIndex,
  getLocalizedBookNameByIndex,
  matchesBookQuery,
  resolveBookIndex,
} from "./book-catalog";
import { HighlightedSnippet } from "../ui/highlighted-snippet";

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
  displayBookName: string;
  chapter?: number;
  verse?: number;
}

interface BookMatch {
  index: number;
  sourceBookName: string;
  displayName: string;
  displayAbbr: string;
}

function parseReference(query: string, language: string, availableBooksByIndex: Map<number, string>): ParsedReference | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Match patterns like "Gn 1:3", "Genesis 1", "1 Sm 3:5", "Song of Solomon 2:1"
  const match = trimmed.match(
    /^(\d?\s*[a-zA-Z\u00C0-\u017F]+(?:\s+[a-zA-Z\u00C0-\u017F]+)*)\s+(\d+)(?::(\d+))?$/,
  );
  if (!match) return null;

  const bookQuery = match[1].replace(/\s+/g, " ").trim();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : undefined;
  const bookIndex = findBookIndexByQuery(bookQuery, language);
  if (bookIndex === null) return null;

  const sourceBookName = availableBooksByIndex.get(bookIndex);
  if (!sourceBookName) return null;

  return {
    bookName: sourceBookName,
    displayBookName: getLocalizedBookNameByIndex(bookIndex, language),
    chapter,
    verse,
  };
}

interface BibleSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  versionId: number | null;
  versionAbbr?: string;
  onNavigate: (book: string, chapter: number, verse: number) => void;
  availableBooks: Set<string>;
}

export function BibleSearch({
  query,
  onQueryChange,
  versionId,
  versionAbbr,
  onNavigate,
  availableBooks,
}: BibleSearchProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const availableBooksByIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const name of availableBooks) {
      const index = resolveBookIndex(name);
      if (index === null || map.has(index)) continue;
      map.set(index, name);
    }
    return map;
  }, [availableBooks]);

  // Debounce the text query for backend search (300ms)
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: textResults, isLoading } = useBibleSearch(debouncedQuery, versionId);

  // Local: instant book name / abbreviation matching
  const bookMatches = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [];

    const matches: BookMatch[] = [];
    for (const [index, sourceBookName] of availableBooksByIndex.entries()) {
      if (!matchesBookQuery(index, q, language, sourceBookName)) continue;
      matches.push({
        index,
        sourceBookName,
        displayName: getLocalizedBookNameByIndex(index, language),
        displayAbbr: getLocalizedBookAbbrByIndex(index),
      });
    }

    return matches.sort((a, b) => a.index - b.index).slice(0, 5);
  }, [query, availableBooksByIndex, language]);

  // Local: instant reference parsing (e.g. "Gn 1:3")
  const parsedRef = useMemo(
    () => parseReference(query, language, availableBooksByIndex),
    [query, language, availableBooksByIndex],
  );

  // Group text search results by book + chapter
  const grouped = useMemo(() => {
    if (!textResults) return [] as Array<{ key: string; label: string; items: BibleSearchResult[] }>;

    const groups = new Map<string, { key: string; label: string; items: BibleSearchResult[] }>();
    for (const result of textResults) {
      const key = `${result.verse.book}::${result.verse.chapter}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(result);
        continue;
      }

      const bookIndex = resolveBookIndex(result.verse.book);
      const displayBook = bookIndex === null ? result.verse.book : getLocalizedBookNameByIndex(bookIndex, language);
      groups.set(key, {
        key,
        label: `${displayBook} ${result.verse.chapter}`,
        items: [result],
      });
    }

    return Array.from(groups.values());
  }, [textResults, language]);

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
                {parsedRef.displayBookName} {parsedRef.chapter}
                {parsedRef.verse ? `:${parsedRef.verse}` : ""}
              </span>
            </button>
          )}

          {/* Book name matches */}
          {bookMatches.length > 0 && !parsedRef && (
            <div className="border-b border-border p-1">
              {bookMatches.map((book) => (
                <button
                  key={`${book.index}-${book.sourceBookName}`}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onNavigate(book.sourceBookName, 1, 1)}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{book.displayAbbr}</span>
                    <span className="ml-1.5 text-muted-foreground">{book.displayName}</span>
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
          {grouped.length > 0 && (
            <div className="p-1">
              {grouped.map((group) => (
                <div key={group.key}>
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}{versionAbbr ? ` · ${versionAbbr}` : ""}
                  </p>
                  {group.items.map((result) => (
                    <button
                      key={result.verse.id}
                      className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() =>
                        onNavigate(result.verse.book, result.verse.chapter, result.verse.verse)
                      }
                    >
                      <span className="font-medium">v.{result.verse.verse}</span>{" "}
                      <span className="text-muted-foreground">
                        <HighlightedSnippet html={result.snippet} />
                      </span>
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
