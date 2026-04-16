import { useTranslation } from "react-i18next";
import { Monitor, ListPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  onPlayNow: () => void;
  onAddToQueue: () => void;
  onClear: () => void;
}

export function SelectionActionBar({ count, onPlayNow, onAddToQueue, onClear }: Props) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface shadow-lg pb-safe",
        "animate-[slideUp_200ms_ease-out]",
      )}
      role="toolbar"
      aria-label={t("remote.search.selection_bar")}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onClear}
          aria-label={t("remote.search.action_clear_selection")}
          className="p-2 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-sm text-fg-muted">
          {t("remote.search.selection_count", { count })}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onAddToQueue}
          className={cn(
            "h-11 px-4 rounded-lg text-sm font-medium border border-border bg-surface-1",
            "flex items-center gap-2 active:scale-[0.98] transition-transform",
          )}
        >
          <ListPlus className="h-4 w-4" aria-hidden="true" />
          {t("remote.search.action_add_to_queue")}
        </button>
        <button
          type="button"
          onClick={onPlayNow}
          className={cn(
            "h-11 px-4 rounded-lg text-sm font-semibold bg-primary text-white",
            "flex items-center gap-2 active:scale-[0.98] transition-transform",
          )}
        >
          <Monitor className="h-4 w-4" aria-hidden="true" />
          {t("remote.search.action_play_now")}
        </button>
      </div>
    </div>
  );
}
