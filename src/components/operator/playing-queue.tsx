import { useQueueStore, type QueueItem } from "../../stores/queue-store";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface PlayingQueueViewProps {
  items: QueueItem[];
  currentIndex: number;
  onItemClick?: (index: number) => void;
  emptyMessage?: string;
}

export function PlayingQueueView({ items, currentIndex, onItemClick, emptyMessage }: PlayingQueueViewProps) {
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
        <button
          key={`${item.id}-${index}`}
          onClick={() => onItemClick?.(index)}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
            index === currentIndex ? "bg-primary text-primary-foreground" : "hover:bg-surface-hover text-foreground"
          )}
        >
          <span className="flex-1 truncate">{item.hymn.title}</span>
          <span className="text-[10px] opacity-70 uppercase font-bold">{item.type}</span>
        </button>
      ))}
    </div>
  );
}

export function PlayingQueue() {
  const { t } = useTranslation();
  const { items, currentIndex, setCurrentIndex } = useQueueStore();
  
  return (
    <PlayingQueueView 
      items={items} 
      currentIndex={currentIndex} 
      onItemClick={setCurrentIndex}
      emptyMessage={t("operator.queueEmpty")}
    />
  );
}
