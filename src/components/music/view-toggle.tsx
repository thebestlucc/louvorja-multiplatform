import { LayoutGrid, List as ListIcon, Star } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

interface ViewToggleProps {
  view: "list" | "grid";
  onSetView: (v: "list" | "grid") => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
}

export function ViewToggle({ view, onSetView, showFavoritesOnly, onToggleFavorites }: ViewToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center rounded-md border p-1 bg-muted/20 gap-1">
      <Button
        variant={showFavoritesOnly ? "outline" : "ghost"}
        size="icon"
        className={cn(
          "h-8 w-8",
          showFavoritesOnly ? "text-yellow-500 hover:text-yellow-600 border-yellow-500/20 bg-yellow-500/5" : "text-muted-foreground"
        )}
        onClick={onToggleFavorites}
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
        onClick={() => onSetView("list")}
        title={t("hymnal.listView")}
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
        onClick={() => onSetView("grid")}
        title={t("hymnal.gridView")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
