import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useHymns } from "../../lib/queries";
import { HymnCard } from "./hymn-card";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMedia } from "react-use";

export function HymnSearch() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: hymns, isLoading } = useHymns(debouncedQuery);

  // Responsive columns for grid view
  const isSm = useMedia("(min-width: 640px)", false);
  const isLg = useMedia("(min-width: 1024px)", false);
  const columns = view === "list" ? 1 : isLg ? 3 : isSm ? 2 : 1;

  const items = hymns || [];
  const rowCount = Math.ceil(items.length / columns);

  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.getElementById("main-scroll-area"),
    estimateSize: () => (view === "list" ? 60 : 260), // approximate heights
    overscan: 5,
  });

  return (
    <div className="space-y-4" ref={listRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("hymnal.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center rounded-md border p-1 bg-muted/20">
          <Button
            variant={view === "list" ? "outline" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("list")}
            title="List view"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "outline" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("grid")}
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
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: view === "grid" ? "12px" : "0",
                  }}
                >
                  <div
                    className={
                      view === "grid"
                        ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 h-full"
                        : "flex flex-col h-full"
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
