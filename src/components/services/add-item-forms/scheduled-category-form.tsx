import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaLibraryCategories } from "../../../lib/queries";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import { cn } from "../../../lib/utils";
import type { AddItemOnAdd } from "./types";

export function ScheduledCategoryForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t, i18n } = useTranslation();
  const { data: categories = [] } = useMediaLibraryCategories(i18n.language);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleAdd = () => {
    const category = categories.find((c) => c.id === selectedId);
    if (category) {
      onAdd("scheduled_category", category.name, category.id, null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ScrollArea className="h-64 rounded-md border p-2">
        <div className="flex flex-col gap-1">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedId(category.id)}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                selectedId === category.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 text-muted-foreground",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </ScrollArea>
      <Button size="sm" disabled={!selectedId} onClick={handleAdd}>
        {t("actions.add")}
      </Button>
    </div>
  );
}
