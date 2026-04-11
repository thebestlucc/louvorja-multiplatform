import { Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useQueueStore, type QueueItem } from "../../stores/queue-store";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface PlayingQueueViewProps {
  items: QueueItem[];
  currentIndex: number;
  onItemClick?: (index: number) => void;
  onRemoveItem?: (index: number) => void;
  emptyMessage?: string;
}

export function PlayingQueueView({ items, currentIndex, onItemClick, onRemoveItem, emptyMessage }: PlayingQueueViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-muted-foreground">{emptyMessage || "Queue is empty"}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      {items.map((item, index) => (
        <div key={`${item.id}-${index}`} className="group relative">
          <button
            onClick={() => onItemClick?.(index)}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors pr-10",
              index === currentIndex ? "bg-primary text-primary-foreground" : "hover:bg-surface-hover text-foreground"
            )}
          >
            <span className="flex-1 truncate">{item.hymn?.title || item.title || "Unknown"}</span>
            <span className="text-[10px] opacity-70 uppercase font-bold">{item.type}</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
                  index === currentIndex ? "text-primary-foreground hover:bg-white/20" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveItem?.(index);
                }}
                aria-label="Remove from queue"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Remove from queue</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

export function PlayingQueue() {
  const { t } = useTranslation();
  const { items, currentIndex, setCurrentIndex, removeFromQueue } = useQueueStore(
    useShallow((s) => ({
      items: s.items,
      currentIndex: s.currentIndex,
      setCurrentIndex: s.setCurrentIndex,
      removeFromQueue: s.removeFromQueue,
    }))
  );
  
  return (
    <PlayingQueueView 
      items={items} 
      currentIndex={currentIndex} 
      onItemClick={setCurrentIndex}
      onRemoveItem={removeFromQueue}
      emptyMessage={t("playingNow.queueEmpty")}
    />
  );
}
