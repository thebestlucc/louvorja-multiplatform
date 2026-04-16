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
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <button
          type="button"
          onClick={onClear}
          aria-label={t("remote.search.action_clear_selection")}
          className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 flex-shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-xs text-fg-muted flex-shrink-0">
          {t("remote.search.selection_count", { count })}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onAddToQueue}
          aria-label={t("remote.search.action_add_to_queue")}
          className={cn(
            "h-9 px-3 rounded-lg text-xs font-medium border border-border bg-surface-1",
            "flex items-center gap-1.5 active:scale-[0.98] transition-transform flex-shrink-0",
          )}
        >
          <ListPlus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden min-[360px]:inline">{t("remote.search.action_add_to_queue")}</span>
        </button>
        <button
          type="button"
          onClick={onPlayNow}
          aria-label={t("remote.search.action_play_now")}
          className={cn(
            "h-9 px-3 rounded-lg text-xs font-semibold bg-primary text-white",
            "flex items-center gap-1.5 active:scale-[0.98] transition-transform flex-shrink-0",
          )}
        >
          <Monitor className="h-4 w-4" aria-hidden="true" />
          <span className="hidden min-[360px]:inline">{t("remote.search.action_play_now")}</span>
        </button>
      </div>
    </div>
  );
}
