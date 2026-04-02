import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBibleVersions, useBooks, useVerses } from "../../../lib/queries";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import { BibleVersionCombobox } from "../../bible/bible-version-combobox";
import { cn } from "../../../lib/utils";
import type { BibleVersion, Book, Verse } from "../../../lib/bindings";
import type { AddItemOnAdd } from "./types";

export function BibleForm({ onAdd, initialTitle: _initialTitle, submitLabel }: { onAdd: AddItemOnAdd; initialTitle?: string; submitLabel?: string }) {
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

  const handleBookSelect = (b: string) => {
    setBook(b);
    setChapter(0);
    setSelectedVerses([]);
  };

  const handleVersionSelect = (id: number) => {
    setVersionId(id);
    setBook("");
    setChapter(0);
    setSelectedVerses([]);
  };

  const handleChapterSelect = (ch: number) => {
    setChapter(ch);
    setSelectedVerses([]);
  };

  const selectedVerseSet = new Set(selectedVerses);

  return (
    <div className="flex flex-col gap-3">
      {/* Version selector */}
      {versions && versions.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("bible.version", "Versão")}
          </label>
          <BibleVersionCombobox
            versions={versions}
            value={versionId}
            onValueChange={handleVersionSelect}
            triggerClassName="flex-1 h-8 text-xs"
          />
        </div>
      )}

      {/* Three-column navigator */}
      <div className="flex h-[380px] overflow-hidden rounded-lg border border-border">

        {/* Column 1: Book list */}
        <div className="flex w-44 flex-shrink-0 flex-col border-r border-border">

          {/* Column header */}
          <div className="shrink-0 border-b border-border px-3 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("bible.book", "Livro")}
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-px p-1.5">
              {(books ?? []).map((b: Book) => (
                <button
                  key={b.name}
                  onClick={() => handleBookSelect(b.name)}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    book === b.name
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-surface-hover",
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Column 2: Chapter grid */}
        <div className={cn(
          "flex w-36 flex-shrink-0 flex-col border-r border-border transition-opacity",
          !book && "pointer-events-none opacity-40",
        )}>
          <div className="shrink-0 border-b border-border px-3 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("bible.chapter", "Capítulo")}
            </p>
          </div>

          <ScrollArea className="flex-1">
            {currentBook ? (
              <div className="grid grid-cols-4 gap-1 p-2">
                {Array.from({ length: currentBook.chapterCount }, (_, i) => i + 1).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => handleChapterSelect(ch)}
                    className={cn(
                      "flex h-8 cursor-pointer items-center justify-center rounded text-xs font-medium transition-colors",
                      chapter === ch
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-surface-hover",
                    )}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-center text-xs text-muted-foreground">
                  {t("bible.selectBook", "Selecione um livro")}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Column 3: Verse picker + Add footer */}
        <div className={cn(
          "flex flex-1 flex-col transition-opacity",
          !chapter && "pointer-events-none opacity-40",
        )}>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("bible.verse", "Versículo")}
            </p>
            {selectedVerses.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {selectedVerses.length}×
              </span>
            )}
          </div>

          <ScrollArea className="flex-1">
            {chapter > 0 ? (
              <div className="grid grid-cols-5 gap-1 p-2">
                {(verses ?? []).map((v: Verse) => (
                  <button
                    key={v.verse}
                    onClick={() => toggleVerse(v.verse)}
                    className={cn(
                      "flex h-8 cursor-pointer items-center justify-center rounded text-xs font-medium transition-colors duration-100",
                      selectedVerseSet.has(v.verse)
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-surface-hover",
                    )}
                  >
                    {v.verse}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-center text-xs text-muted-foreground">
                  {t("bible.selectChapter", "Selecione um capítulo")}
                </p>
              </div>
            )}
          </ScrollArea>

          {/* Add button pinned to bottom of column 3 */}
          <div className="shrink-0 border-t border-border p-2">
            <Button
              className="w-full"
              size="sm"
              disabled={selectedVerses.length === 0}
              onClick={handleAdd}
            >
              {selectedVerses.length > 0
                ? `${submitLabel ?? t("actions.add")} (${book} ${chapter}:${(() => {
                    const s = selectedVerses;
                    return s.length === 1 ? s[0] : `${s[0]}–${s[s.length - 1]}`;
                  })()})`
                : (submitLabel ?? t("actions.add"))}
            </Button>
          </div>
        </div>
      </div>

      {/* Selection summary */}
      {selectedVerses.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{book} {chapter}:{selectedVerses.length === 1 ? selectedVerses[0] : `${selectedVerses[0]}–${selectedVerses[selectedVerses.length - 1]}`}</span>
          {currentVersion && <span> ({currentVersion.abbreviation})</span>}
          {" — "}{selectedVerses.length} {t("bible.verses").toLowerCase()}
        </p>
      )}
    </div>
  );
}
