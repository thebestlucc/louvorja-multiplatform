import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { useBibleVersions, useBooks, useVerses } from "../../../lib/queries";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import { cn } from "../../../lib/utils";
import type { BibleVersion, Book, Verse } from "../../../lib/bindings";
import type { AddItemOnAdd } from "./types";

export function BibleForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t } = useTranslation();
  const [versionId, setVersionId] = useState(0);
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState(0);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);

  const { data: versions } = useBibleVersions();
  const { data: books } = useBooks(versionId);
  const { data: verses } = useVerses(versionId, book, chapter);

  useEffect(() => {
    if (versions && versions.length > 0 && versionId === 0) {
      setVersionId(versions[0].id);
    }
  }, [versions, versionId]);

  const currentVersion = versions?.find((v: BibleVersion) => v.id === versionId);
  const currentBook = books?.find((b: Book) => b.name === book);

  const toggleVerse = (v: number) => {
    setSelectedVerses((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b),
    );
  };

  const handleAdd = () => {
    if (!book || !chapter || selectedVerses.length === 0) return;
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const range = sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
    const title = `${book} ${chapter}:${range}${currentVersion ? ` (${currentVersion.abbreviation})` : ""}`;
    const verseSet = new Set(sorted);
    const verseTexts = (verses ?? [])
      .filter((v: Verse) => verseSet.has(v.verse))
      .map((v: Verse) => `${v.verse} ${v.text}`)
      .join("\n");
    onAdd("bible", title, null, verseTexts || null);
  };

  const handleBack = () => {
    if (chapter > 0) { setChapter(0); setSelectedVerses([]); }
    else if (book) { setBook(""); }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Version buttons */}
      {versions && versions.length > 1 && (
        <div className="flex gap-1.5">
          {versions.map((v: BibleVersion) => (
            <Button
              key={v.id}
              variant={v.id === versionId ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setVersionId(v.id); setBook(""); setChapter(0); setSelectedVerses([]); }}
            >
              {v.abbreviation}
            </Button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      {book && (
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={handleBack} className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-medium">{book}</span>
          {chapter > 0 && <span className="text-muted-foreground">{chapter}</span>}
          {selectedVerses.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {selectedVerses.length} {t("bible.verses").toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/* Book list */}
      {!book && (
        <ScrollArea className="h-56">
          <div className="grid grid-cols-3 gap-1">
            {(books ?? []).map((b: Book) => (
              <button
                key={b.name}
                className="cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover"
                onClick={() => setBook(b.name)}
              >
                {b.name}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Chapter grid */}
      {book && chapter === 0 && currentBook && (
        <ScrollArea className="h-56">
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: currentBook.chapterCount }, (_, i) => i + 1).map((ch) => (
              <button
                key={ch}
                className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-border text-xs font-medium transition-colors hover:bg-surface-hover"
                onClick={() => setChapter(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Verse picker */}
      {book && chapter > 0 && (
        <>
          <ScrollArea className="h-44">
            {(() => {
              const selectedVerseSet = new Set(selectedVerses);
              return (
            <div className="grid grid-cols-8 gap-1.5">
              {(verses ?? []).map((v: Verse) => (
                <button
                  key={v.verse}
                  className={cn(
                    "flex h-7 cursor-pointer items-center justify-center rounded-md text-xs font-medium transition-colors duration-150",
                    selectedVerseSet.has(v.verse)
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-surface-hover",
                  )}
                  onClick={() => toggleVerse(v.verse)}
                >
                  {v.verse}
                </button>
              ))}
            </div>
              );
            })()}
          </ScrollArea>
          <Button size="sm" disabled={selectedVerses.length === 0} onClick={handleAdd}>
            {t("actions.add")}
          </Button>
        </>
      )}
    </div>
  );
}
