import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { useHymns } from "../../lib/queries";
import { HymnCard } from "./hymn-card";

export function HymnSearch() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: hymns, isLoading } = useHymns(debouncedQuery);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("hymnal.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      )}

      {hymns && hymns.length === 0 && debouncedQuery && (
        <p className="text-sm text-muted-foreground">{t("hymnal.noResults")}</p>
      )}

      {hymns && hymns.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {hymns.map((hymn) => (
            <HymnCard key={hymn.id} hymn={hymn} />
          ))}
        </div>
      )}
    </div>
  );
}
