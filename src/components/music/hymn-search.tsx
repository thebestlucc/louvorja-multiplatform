import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, LayoutGrid, List as ListIcon, Star } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useHymns, useFavoriteHymns } from "../../lib/queries";
import { HymnCard } from "./hymn-card";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "react-use";
import { cn } from "../../lib/utils";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { getPreference, setPreference } from "../../lib/store";

const VIEW_PREF_KEY = "hymnal.viewType";

export function HymnSearch() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    void getPreference<"list" | "grid">(VIEW_PREF_KEY, "list").then(setView);
  }, []);

  const handleSetView = (v: "list" | "grid") => {
    setView(v);
    void setPreference(VIEW_PREF_KEY, v);
  };

  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: searchResults, isLoading: isSearchLoading } = useHymns(debouncedQuery, { enabled: !showFavoritesOnly });
  const { data: favoriteHymns, isLoading: isFavoritesLoading } = useFavoriteHymns(debouncedQuery, { enabled: showFavoritesOnly });

  const isLoading = showFavoritesOnly ? isFavoritesLoading : isSearchLoading;

  // Filter or select source based on toggle
  const hymns = showFavoritesOnly
    ? favoriteHymns
    : searchResults;

  // Responsive columns for grid view — single resize listener via useWindowSize
  const { width = 1280 } = useWindowSize();
  const columns = useMemo(() => {
    if (view === "list") return 1;
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 768) return 4;
    if (width >= 640) return 3;
    return 2;
  }, [view, width]);

  const items = hymns || [];
  const rowCount = Math.ceil(items.length / columns);

  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.getElementById("main-scroll-area"),
    estimateSize: () => (view === "list" ? 60 : 280),
    overscan: 5,
    gap: 16,
  });

  return (
    <div className="space-y-4" ref={listRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1" data-tour="hymnal-search">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("hymnal.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center rounded-md border p-1 bg-muted/20 gap-1">
          <Button
            variant={showFavoritesOnly ? "outline" : "ghost"}
            size="icon"
            className={cn(
              "h-8 w-8",
              showFavoritesOnly ? "text-yellow-500 hover:text-yellow-600 border-yellow-500/20 bg-yellow-500/5" : "text-muted-foreground"
            )}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            title={t("favorites.title")}
          >
            <Star className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-all",
              view === "list" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => handleSetView("list")}
            title="List view"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-all",
              view === "grid" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => handleSetView("grid")}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      )}

      {hymns && hymns.length === 0 && debouncedQuery && (
        <p className="text-sm text-muted-foreground">{t("hymnal.noResults")}</p>
      )}

      {hymns && hymns.length === 0 && !debouncedQuery && showFavoritesOnly && (
        <p className="text-sm text-muted-foreground">{t("favorites.empty")}</p>
      )}

      {hymns && hymns.length > 0 && (
        <div className={view === "list" ? "rounded-lg border border-border bg-card overflow-hidden" : ""}>
          {view === "list" && (
            <div className="grid grid-cols-[80px_2fr_1fr_120px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="pl-2">{t("hymnal.number", "ID")}</div>
              <div>{t("hymnal.title", "Hymn Name")}</div>
              <div>{t("hymnal.album", "Album")}</div>
              <div className="text-right pr-2">{t("table.actions", "Actions")}</div>
            </div>
          )}
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
                      view === "grid"
                        ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                        : "flex flex-col"
                    }
                  >
                    {rowItems.map((hymn) => (
                      <div key={hymn.id} className="h-full">
                        <HymnCard hymn={hymn} view={view} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
