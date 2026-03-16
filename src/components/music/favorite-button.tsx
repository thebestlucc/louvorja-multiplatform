import { Star } from "lucide-react";
import { Button } from "../ui/button";
import { useToggleFavorite, useIsFavorite } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { notify } from "../../lib/notifications";
import { useTranslation } from "react-i18next";
import { catcher } from "../../lib/catcher";

interface FavoriteButtonProps {
  itemType: "hymn" | "bible";
  itemId: number;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "ghost" | "outline" | "default";
}

export function FavoriteButton({
  itemType,
  itemId,
  className,
  size = "icon",
  variant = "ghost",
}: FavoriteButtonProps) {
  const { t } = useTranslation();
  const { data: isFav, isLoading } = useIsFavorite(itemType, itemId);
  const toggleMutation = useToggleFavorite();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading || toggleMutation.isPending) return;

    const [_, error] = await catcher(
      toggleMutation.mutateAsync({ itemType, itemId }),
      { notify: true }
    );

    if (!error) {
      // Success is handled by TanStack Query cache invalidation
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "transition-all duration-200 active:scale-95",
        isFav ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10" : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={handleToggle}
      disabled={isLoading || toggleMutation.isPending}
      title={isFav ? t("favorites.remove") : t("favorites.add")}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-transform duration-300",
          isFav ? "fill-current scale-110" : "fill-none"
        )}
      />
    </Button>
  );
}
