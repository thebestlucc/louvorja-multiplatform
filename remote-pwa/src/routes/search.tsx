import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

type SearchTab = "hymns" | "bible" | "services";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface SearchResultsPayload {
  items: SearchResultItem[];
}

const DEBOUNCE_MS = 400;

export default function SearchRoute() {
  const { t } = useTranslation();
  const ws = useConnectionStore((s) => s.ws);

  const [tab, setTab] = useState<SearchTab>("hymns");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);

  // TODO(review): debounceRef timer is not cleared on unmount — if a 400ms timer fires after
  // component unmount, it will call ws.send on a potentially stale ws. Add a cleanup useEffect
  // that calls clearTimeout(debounceRef.current) on unmount. (ring:code-reviewer, 2026-04-12, Low)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Subscribe to search.results
  useEffect(() => {
    if (!ws || typeof ws.on !== "function") return;
    const unsub = ws.on("search.results", (payload) => {
      const p = payload as SearchResultsPayload;
      setResults(p.items ?? []);
    });
    return unsub;
  }, [ws]);

  // Clear results when tab changes
  useEffect(() => {
    setQuery("");
    setResults([]);
  }, [tab]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current !== undefined) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(() => {
        ws?.send("search.query", { query: value, category: tab });
      }, DEBOUNCE_MS);
    },
    [ws, tab],
  );

  const handleSelect = useCallback(
    (id: string) => {
      ws?.send("search.select", { id });
    },
    [ws],
  );

  const placeholder =
    tab === "hymns"
      ? t("remote.search.placeholder_hymns")
      : tab === "bible"
        ? t("remote.search.placeholder_bible")
        : t("remote.search.placeholder_service");

  const tabs: { id: SearchTab; label: string }[] = [
    { id: "hymns", label: t("remote.search.tab_hymns") },
    { id: "bible", label: t("remote.search.tab_bible") },
    { id: "services", label: t("remote.search.tab_services") },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div role="tablist" aria-label="Search categories" className="flex border-b border-border">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-b-2 border-primary text-primary"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className={cn(
              "w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-surface-1 text-sm text-fg placeholder:text-fg-subtle",
              "focus:outline-none focus:ring-2 focus:ring-primary",
            )}
          />
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && query.trim() !== "" && (
          <p className="text-center text-sm text-fg-muted py-8">{t("remote.search.no_results")}</p>
        )}
        <ul>
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border last:border-0",
                  "hover:bg-surface-2 active:bg-surface-2 transition-colors",
                )}
              >
                <p className="text-sm font-medium text-fg">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-fg-muted mt-0.5">{item.subtitle}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
