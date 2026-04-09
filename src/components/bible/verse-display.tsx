import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type { Verse } from "../../types/bible";
import { Copy, Plus, Columns2, Monitor } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation-store";
import { useAddLiturgyItem } from "../../lib/queries";
import { copyToClipboard } from "../../lib/clipboard";
import { notify } from "../../lib/notifications";
import { getLocalizedBookName } from "./book-catalog";

interface VerseDisplayProps {
  verses: Verse[];
  selectedVerses: number[];
  scrollToVerse?: number | null;
  book: string;
  chapter: number;
  versionAbbr?: string;
  onSelectVerse: (verse: number, shiftKey?: boolean) => void;
  onDoubleClickVerse: (verse: number) => void;
  isLoading: boolean;
  onOpenCompare?: () => void;
  isProjecting?: boolean;
  onProject?: () => void;
  /** Split slide parts for the projected verse (from presentationStore) */
  splitSlides?: import("../../lib/bindings").SlideContent[];
  /** Active split part index */
  activeSplitIndex?: number;
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
  onOpenCompare,
  isProjecting,
  onProject,
  splitSlides,
  activeSplitIndex,
}: VerseDisplayProps) {
  const { t, i18n } = useTranslation();
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const addItemMutation = useAddLiturgyItem();
  const verseRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const displayBook = getLocalizedBookName(book, i18n.resolvedLanguage ?? i18n.language);

  const setVerseRef = useCallback((verse: number, el: HTMLDivElement | null) => {
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

  const handleCopyVerses = async () => {
    if (selectedVerses.length === 0) return;
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const reference = `${displayBook} ${chapter}:${sorted.length === 1 ? sorted[0] : `${sorted[0]}-${sorted[sorted.length - 1]}`}${versionAbbr ? ` (${versionAbbr})` : ""}`;
    const selectedSet = new Set(sorted);
    const text = verses
      .filter((v) => selectedSet.has(v.verse))
      .map((v) => `${v.verse} ${v.text}`)
      .join("\n");
    await copyToClipboard(`${reference}\n${text}`);
    notify.success(t("bible.verseCopied"));
  };

  const handleAddToService = () => {
    if (!activeLiturgyId || selectedVerses.length === 0) return;
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const verseRange =
      sorted.length === 1
        ? String(sorted[0])
        : `${sorted[0]}-${sorted[sorted.length - 1]}`;
    const title = `${book} ${chapter}:${verseRange}${versionAbbr ? ` (${versionAbbr})` : ""}`;
    addItemMutation.mutate({
      serviceId: activeLiturgyId,
      itemType: "bible",
      title,
      itemId: null,
      notes: null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("bible.loading")}</p>
      </div>
    );
  }

  if (verses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("bible.noResults")}</p>
      </div>
    );
  }

  const selectedSet = new Set(selectedVerses);
  const hasSelection = selectedVerses.length > 0;

  // Build selected verse range label
  const selectionLabel = hasSelection
    ? (() => {
        const sorted = [...selectedVerses].sort((a, b) => a - b);
        const range =
          sorted.length === 1
            ? String(sorted[0])
            : `${sorted[0]}-${sorted[sorted.length - 1]}`;
        return `${displayBook} ${chapter}:${range}`;
      })()
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header with reference + actions */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface pb-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight">
              {displayBook} {chapter}
            </h3>
            {versionAbbr && (
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {versionAbbr}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onOpenCompare && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenCompare}
                title={t("bible.comparison")}
                className="h-7 w-7 p-0"
              >
                <Columns2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {hasSelection && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleCopyVerses()}
                title={t("bible.copyVerse")}
                className="h-7 w-7 p-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Selection action bar — shows when verses are selected */}
        {hasSelection && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-medium text-primary truncate flex-1">
              {selectionLabel}
            </span>
            {onProject && (
              <Button
                size="sm"
                variant={isProjecting ? "outline" : "default"}
                onClick={onProject}
                className="h-7 gap-1.5 text-xs shrink-0"
              >
                <Monitor className="h-3.5 w-3.5" />
                {t("bible.project")}
              </Button>
            )}
            {activeLiturgyId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddToService}
                className="h-7 gap-1 text-xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("services.addToService")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Verse list */}
      <div className="mt-1 flex-1 space-y-px overflow-y-auto">
        {verses.map((v) => {
          const isSelected = selectedSet.has(v.verse);
          // When this verse is projected and has split parts, show each part separately
          const hasSplitParts = isSelected && isProjecting && splitSlides && splitSlides.length > 1;

          if (hasSplitParts) {
            return splitSlides.map((slide, partIdx) => {
              const slideText = slide.slideType === "bible" ? slide.text : "";
              const isActivePart = partIdx === (activeSplitIndex ?? 0);
              return (
                <div
                  key={`${v.verse}-part-${partIdx}`}
                  ref={partIdx === 0 ? (el) => setVerseRef(v.verse, el) : undefined}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-sm leading-relaxed transition-colors",
                    isActivePart
                      ? "bg-primary/18 text-foreground ring-1 ring-primary/40"
                      : "bg-primary/6 text-foreground/70",
                  )}
                >
                  <span className="mr-2 inline-block min-w-[1.5rem] text-right text-xs font-bold tabular-nums text-primary">
                    {v.verse}<span className="text-[9px] text-muted-foreground ml-0.5">({partIdx + 1}/{splitSlides.length})</span>
                  </span>
                  <span>{slideText}</span>
                </div>
              );
            });
          }

          return (
            <div
              key={v.verse}
              ref={(el) => setVerseRef(v.verse, el)}
              role="button"
              tabIndex={0}
              className={cn(
                "group cursor-pointer rounded px-2.5 py-1.5 text-sm leading-relaxed transition-colors",
                isSelected
                  ? "bg-primary/12 text-foreground ring-1 ring-primary/25"
                  : "hover:bg-surface-hover",
              )}
              onClick={(ev) => onSelectVerse(v.verse, ev.shiftKey)}
              onDoubleClick={() => onDoubleClickVerse(v.verse)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onDoubleClickVerse(v.verse);
                }
              }}
              aria-selected={isSelected}
            >
              <span
                className={cn(
                  "mr-2 inline-block min-w-[1.5rem] text-right text-xs font-bold tabular-nums",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
              >
                {v.verse}
              </span>
              <span className={isSelected ? "text-foreground" : ""}>
                {v.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
