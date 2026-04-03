import { useTranslation } from "react-i18next";
import { CalendarClock, CalendarX } from "lucide-react";
import { useMediaLibraryCategories } from "../../../lib/queries";
import { ScrollArea } from "../../ui/scroll-area";
import { cn } from "../../../lib/utils";
import type { AddItemOnAdd } from "./types";

export function ScheduledCategoryForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t, i18n } = useTranslation();
  const { data: categories = [], isLoading } = useMediaLibraryCategories(i18n.language);

  const handleSelect = (id: number, name: string) => {
    onAdd("scheduled_category", name, id, null);
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">{t("bible.loading")}</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <CalendarX className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{t("utilities.mediaLibrary.noCategories", "No scheduled categories")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("utilities.mediaLibrary.noCategoriesHint", "Create categories in the Media Library first.")}</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[340px]">
      <div className="flex flex-col gap-0.5">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => handleSelect(category.id, category.name)}
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
              "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-500/10 transition-colors group-hover:bg-rose-500/20">
              <CalendarClock className="h-4 w-4 text-rose-500" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
              <span className="truncate text-xs text-muted-foreground">{t("utilities.mediaLibrary.resolvedByDate", "Resolved by today's date at playback")}</span>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
