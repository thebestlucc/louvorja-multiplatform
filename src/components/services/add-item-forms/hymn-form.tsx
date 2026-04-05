import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useAllMusic } from "../../../lib/queries";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import { CoverImage } from "../../media/cover-image";
import type { Hymn } from "../../../lib/bindings";
import type { AddItemOnAdd } from "./types";

export function HymnForm({ onAdd, initialTitle, submitLabel: _submitLabel }: { onAdd: AddItemOnAdd; initialTitle?: string; submitLabel?: string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialTitle ?? "");
  const { data: hymns } = useAllMusic(query);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("hymnal.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <ScrollArea className="h-85">
        <div className="flex flex-col gap-0.5">
          {(hymns ?? []).map((hymn: Hymn) => (
            <button
              key={hymn.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover"
              onClick={() => onAdd("hymn", hymn.title, hymn.id, null)}
            >
              <CoverImage
                path={hymn.coverPath}
                title={hymn.title}
                className="h-8 w-8 rounded shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  {hymn.number != null && (
                    <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold tabular-nums text-primary">
                      #{hymn.number}
                    </span>
                  )}
                  <span className="truncate font-medium text-foreground">{hymn.title}</span>
                </div>
                {hymn.album && (
                  <span className="truncate text-xs text-muted-foreground">{hymn.album}</span>
                )}
              </div>
            </button>
          ))}
          {(hymns ?? []).length === 0 && query.length > 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("hymnal.noResults")}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
