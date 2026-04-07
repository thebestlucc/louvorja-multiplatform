import { useState, useMemo, useRef, useDeferredValue, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { useHymnsList, useFavoriteIds } from "../../lib/queries";
import { HymnCard } from "./hymn-card";
import { ViewToggle } from "./view-toggle";
import { useResponsiveColumns, GRID_COLS_CLASS } from "../../hooks/use-responsive-columns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/utils";
import { useStorePreference, useSetStorePreference } from "../../lib/queries/settings";

const VIEW_PREF_KEY = "hymnal.viewType";

export function HymnSearch() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data: view } = useStorePreference<"list" | "grid">(VIEW_PREF_KEY, "list");
  const setStoredView = useSetStorePreference<"list" | "grid">(VIEW_PREF_KEY);

  // Buttons highlight instantly via `view`; the virtualizer uses `renderView`
  // which defers the heavy re-render so the toggle feels snappy.
  const renderView = useDeferredValue(view ?? "list");

  const handleSetView = (v: "list" | "grid") => {
    setStoredView(v);
  };

  const deferredQuery = useDeferredValue(query);
  const isPending = query !== deferredQuery;

  const { data: searchResults, isLoading: isSearchLoading } = useHymnsList(deferredQuery);

  const { data: rawFavoriteIds } = useFavoriteIds("hymn");
  const favoriteIds = useMemo(() => new Set(rawFavoriteIds ?? []), [rawFavoriteIds]);

  const isLoading = isSearchLoading;

  // Client-side filter: use the favoriteIds Set to filter the already-loaded hymn list.
  // This works regardless of whether hymns come from the app DB or content DB.
  const hymns = useMemo(() => {
    if (!searchResults) return undefined;
    if (!showFavoritesOnly) return searchResults;
    return searchResults.filter((h) => favoriteIds.has(h.id));
  }, [searchResults, showFavoritesOnly, favoriteIds]);

  const columns = useResponsiveColumns(renderView);
  const items = useMemo(() => hymns || [], [hymns]);
  const rowCount = Math.ceil(items.length / columns);

  const scrollRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const estimateSize = useCallback(
    () => (renderView === "list" ? 60 : 280),
    [renderView],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize,
    overscan: 5,
    gap: 16,
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative flex-1" data-tour="hymnal-search">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("hymnal.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <ViewToggle
          view={view ?? "list"}
          onSetView={handleSetView}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
        )}

        {hymns && hymns.length === 0 && deferredQuery && (
          <p className="text-sm text-muted-foreground">{t("hymnal.noResults")}</p>
        )}

        {hymns && hymns.length === 0 && !deferredQuery && showFavoritesOnly && (
          <p className="text-sm text-muted-foreground">{t("favorites.empty")}</p>
        )}

        {hymns && hymns.length > 0 && view !== undefined && (
          <>
            {/* Sticky table header — outside card border so sticky positioning works */}
            {renderView === "list" && (
              <div className="sticky top-0 z-10 grid grid-cols-[80px_2fr_1fr_120px] gap-4 rounded-t-lg border border-b-0 border-border bg-muted px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="pl-2">{t("hymnal.number", "ID")}</div>
                <div>{t("hymnal.title", "Hymn Name")}</div>
                <div>{t("hymnal.album", "Album")}</div>
                <div className="text-right pr-2">{t("table.actions", "Actions")}</div>
              </div>
            )}

            <div className={cn(
              renderView === "list" ? "rounded-b-lg border border-t-0 border-border bg-card" : "",
              isPending && "opacity-60 transition-opacity",
            )}>
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const startIndex = virtualRow.index * columns;
                  const rowItems = items.slice(startIndex, startIndex + columns);

                  return (
                    <div
                      key={virtualRow.key}
                      ref={virtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        className={
                          renderView === "grid"
                            ? GRID_COLS_CLASS
                            : "flex flex-col"
                        }
                      >
                        {rowItems.map((hymn) => (
                          <div key={hymn.id} className="h-full">
                            <HymnCard hymn={hymn} view={renderView} favoriteIds={favoriteIds} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
