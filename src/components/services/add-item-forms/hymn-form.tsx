import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHymns } from "../../../lib/queries";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import { CoverImage } from "../../media/cover-image";
import type { Hymn } from "../../../lib/bindings";
import type { AddItemOnAdd } from "./types";

export function HymnForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: hymns } = useHymns(query);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("hymnal.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <ScrollArea className="h-56">
        <div className="flex flex-col gap-0.5">
          {(hymns ?? []).map((hymn: Hymn) => (
            <button
              key={hymn.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
              onClick={() => onAdd("hymn", hymn.title, hymn.id, null)}
            >
              <CoverImage
                path={hymn.coverPath}
                title={hymn.title}
                className="h-7 w-7 rounded shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  {hymn.number != null && (
                    <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded bg-blue-500/10 text-[10px] font-semibold tabular-nums text-blue-600">
                      #{hymn.number}
                    </span>
                  )}
                  <span className="truncate font-medium">{hymn.title}</span>
                </div>
                {hymn.album && (
                  <span className="truncate text-[10px] text-muted-foreground">{hymn.album}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
