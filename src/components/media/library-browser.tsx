import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaLibraryCategories, useMediaLibraryItems } from "../../lib/queries";
import { ScrollArea } from "../ui/scroll-area";
import { FileIcon, Search } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

interface LibraryBrowserProps {
  onSelect: (name: string, path: string) => void;
}

export function LibraryBrowser({ onSelect }: LibraryBrowserProps) {
  const { t, i18n } = useTranslation();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories = [] } = useMediaLibraryCategories(i18n.language);
  const { data: items = [] } = useMediaLibraryItems(selectedCategoryId ?? 0);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-80 flex-col gap-3">
      <div className="flex h-full gap-2 overflow-hidden">
        <div className="w-32 shrink-0 border-r pr-2">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover",
                    selectedCategoryId === cat.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="truncate block">{cat.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("actions.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <ScrollArea className="flex-1">
            {selectedCategoryId === null ? (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center opacity-50">
                <p className="text-xs text-muted-foreground">{t("mediaLibrary.selectCategoryHint")}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center opacity-50">
                <p className="text-xs text-muted-foreground">{t("mediaLibrary.noItems")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-2">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.name, item.filePath)}
                    className="group flex cursor-pointer flex-col gap-1 rounded-md border border-border bg-surface p-2 text-left transition-colors hover:border-primary/50 hover:bg-surface-hover"
                  >
                    <div className="flex aspect-video items-center justify-center rounded bg-accent/5">
                      {item.thumbnailPath ? (
                        <img src={item.thumbnailPath} alt={item.name} className="h-full w-full object-cover rounded" />
                      ) : (
                        <FileIcon className="h-6 w-6 text-muted-foreground/30" />
                      )}
                    </div>
                    <span className="truncate text-[10px] font-medium text-foreground" title={item.name}>
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
