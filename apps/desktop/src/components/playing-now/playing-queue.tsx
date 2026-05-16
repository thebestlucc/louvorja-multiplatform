import { Trash2, GripVertical, Music, BookOpen, Film, Presentation as PresentationIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useQueueStore, type QueueItem } from "../../stores/queue-store";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function kindIcon(kind: QueueItem["kind"]) {
  switch (kind) {
    case "hymn":         return <Music className="h-3.5 w-3.5" aria-hidden="true" />;
    case "bible":        return <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />;
    case "video":        return <Film className="h-3.5 w-3.5" aria-hidden="true" />;
    case "presentation": return <PresentationIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

function rowTitle(item: QueueItem): string {
  return item.hymn?.title ?? item.title ?? `${item.kind}`;
}

interface SortableItemProps {
  item: QueueItem;
  index: number;
  currentIndex: number;
  onItemClick?: (index: number) => void;
  onRemoveItem?: (index: number) => void;
}

function SortableQueueItem({ item, index, currentIndex, onItemClick, onRemoveItem }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <button
        onClick={() => onItemClick?.(index)}
        className={cn(
          "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors pr-10",
          index === currentIndex ? "bg-primary text-primary-foreground" : "hover:bg-surface-hover text-foreground"
        )}
      >
        <span
          className={cn(
            "flex-shrink-0 cursor-grab active:cursor-grabbing touch-none",
            index === currentIndex ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="flex-shrink-0 text-current opacity-70">{kindIcon(item.kind)}</span>
        <span className="flex-1 truncate">{rowTitle(item)}</span>
        <span className="text-[10px] opacity-70 uppercase font-bold">{item.kind === "hymn" ? item.type : ""}</span>
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
  );
}

interface PlayingQueueViewProps {
  items: QueueItem[];
  currentIndex: number;
  onItemClick?: (index: number) => void;
  onRemoveItem?: (index: number) => void;
  onMoveItem?: (fromIndex: number, toIndex: number) => void;
  emptyMessage?: string;
}

export function PlayingQueueView({ items, currentIndex, onItemClick, onRemoveItem, emptyMessage }: Omit<PlayingQueueViewProps, "onMoveItem">) {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-muted-foreground">{emptyMessage ?? "Queue is empty"}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      {items.map((item, index) => (
        <div key={item.id} className="group relative">
          <button
            onClick={() => onItemClick?.(index)}
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors pr-10",
              index === currentIndex ? "bg-primary text-primary-foreground" : "hover:bg-surface-hover text-foreground",
            )}
          >
            <span className="flex-shrink-0 text-current opacity-70">{kindIcon(item.kind)}</span>
            <span className="flex-1 truncate">{rowTitle(item)}</span>
            <span className="text-[10px] opacity-70 uppercase font-bold">{item.kind === "hymn" ? item.type : ""}</span>
          </button>
          <button
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
              index === currentIndex ? "text-primary-foreground" : "text-muted-foreground",
            )}
            onClick={(e) => { e.stopPropagation(); onRemoveItem?.(index); }}
            aria-label="Remove from queue"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PlayingQueueDndWrapper({ items, currentIndex, onItemClick, onRemoveItem, onMoveItem, emptyMessage }: PlayingQueueViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-muted-foreground">{emptyMessage ?? "Queue is empty"}</span>
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = items.findIndex((i) => i.id === active.id);
    const toIndex = items.findIndex((i) => i.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onMoveItem?.(fromIndex, toIndex);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1 overflow-y-auto p-2">
          {items.map((item, index) => (
            <SortableQueueItem
              key={item.id}
              item={item}
              index={index}
              currentIndex={currentIndex}
              onItemClick={onItemClick}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function PlayingQueue() {
  const { t } = useTranslation();
  const { items, currentIndex, setCurrentIndex, removeFromQueue, moveItem } = useQueueStore(
    useShallow((s) => ({
      items: s.items,
      currentIndex: s.currentIndex,
      setCurrentIndex: s.setCurrentIndex,
      removeFromQueue: s.removeFromQueue,
      moveItem: s.moveItem,
    }))
  );

  return (
    <PlayingQueueDndWrapper
      items={items}
      currentIndex={currentIndex}
      onItemClick={setCurrentIndex}
      onRemoveItem={removeFromQueue}
      onMoveItem={moveItem}
      emptyMessage={t("playingNow.queueEmpty")}
    />
  );
}
