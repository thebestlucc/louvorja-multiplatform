import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type { Verse } from "../../types/bible";
import { Plus } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAddServiceItem } from "../../lib/queries";
import { getLocalizedBookName } from "./book-catalog";

interface VerseDisplayProps {
  verses: Verse[];
  selectedVerses: number[];
  scrollToVerse?: number | null;
  book: string;
  chapter: number;
  versionAbbr?: string;
  onSelectVerse: (verse: number) => void;
  onDoubleClickVerse: (verse: number) => void;
  isLoading: boolean;
}

export function VerseDisplay({
  verses,
  selectedVerses,
  scrollToVerse,
  book,
  chapter,
  versionAbbr,
  onSelectVerse,
  onDoubleClickVerse,
  isLoading,
}: VerseDisplayProps) {
  const { t, i18n } = useTranslation();
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);
  const addItemMutation = useAddServiceItem();
  const verseRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const displayBook = getLocalizedBookName(book, i18n.resolvedLanguage ?? i18n.language);

  const setVerseRef = useCallback((verse: number, el: HTMLParagraphElement | null) => {
    if (el) {
      verseRefs.current.set(verse, el);
    } else {
      verseRefs.current.delete(verse);
    }
  }, []);

  useEffect(() => {
    if (scrollToVerse && scrollToVerse > 0) {
      const el = verseRefs.current.get(scrollToVerse);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [scrollToVerse]);

  const handleAddToService = () => {
    if (!activeServiceId || selectedVerses.length === 0) return;
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const verseRange =
      sorted.length === 1
        ? String(sorted[0])
        : `${sorted[0]}-${sorted[sorted.length - 1]}`;
    const title = `${book} ${chapter}:${verseRange}${versionAbbr ? ` (${versionAbbr})` : ""}`;
    addItemMutation.mutate({
      serviceId: activeServiceId,
      itemType: "bible",
      title,
      itemId: null,
      notes: null,
    });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>;
  }

  if (verses.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("bible.noResults")}</p>;
  }

  const selectedSet = new Set(selectedVerses);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface pb-2">
        <div>
          <h3 className="text-lg font-semibold">
            {displayBook} {chapter}
          </h3>
          {versionAbbr && (
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {versionAbbr}
            </span>
          )}
        </div>
        {selectedVerses.length > 0 && activeServiceId && (
          <Button size="sm" variant="outline" onClick={handleAddToService}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("services.addToService")}
          </Button>
        )}
      </div>
      <div className="space-y-0.5">
        {verses.map((v) => (
          <p
            key={v.verse}
            ref={(el) => setVerseRef(v.verse, el)}
            className={cn(
              "cursor-pointer rounded-sm px-2 py-1 text-sm leading-relaxed transition-colors",
              selectedSet.has(v.verse)
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted",
            )}
            onClick={() => onSelectVerse(v.verse)}
            onDoubleClick={() => onDoubleClickVerse(v.verse)}
          >
            <strong className="mr-1.5 inline-block min-w-[1.25rem] text-xs text-muted-foreground">
              {v.verse}
            </strong>
            {v.text}
          </p>
        ))}
      </div>
    </div>
  );
}
