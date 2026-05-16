import { useEffect, useRef } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Copy, Trash2 } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import { SlideThumbnail } from "./slide-thumbnail";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface SlideListProps {
  slides: SlideContent[];
  activeIndex: number;
  onSelect: (index: number) => void;
  enableGlobalKeyboardNav?: boolean;
  /** If provided, enables drag-and-drop reordering */
  onReorder?: (from: number, to: number) => void;
  /** If provided, shows an "Add Slide" button */
  onAdd?: () => void;
  /** If provided, enables duplicate via context menu */
  onDuplicate?: (index: number) => void;
  /** If provided, enables delete via context menu */
  onDelete?: (index: number) => void;
  /** Unique IDs for sortable items (slide DB ids) */
  itemIds?: number[];
  showNumbers?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function SlideList({
  slides,
  activeIndex,
  onSelect,
  enableGlobalKeyboardNav = true,
  onReorder,
  onAdd,
  onDuplicate,
  onDelete,
  itemIds,
}: SlideListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!enableGlobalKeyboardNav) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowUp" && activeIndex > 0) {
        e.preventDefault();
        onSelect(activeIndex - 1);
      }
      if (e.key === "ArrowDown" && activeIndex < slides.length - 1) {
        e.preventDefault();
        onSelect(activeIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, enableGlobalKeyboardNav, slides.length, onSelect]);

  if (slides.length === 0 && !onAdd) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorder || !itemIds) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(Number(active.id));
      const newIndex = itemIds.indexOf(Number(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  const sortableEnabled = !!onReorder && !!itemIds;
  const ids = itemIds ?? slides.map((_, i) => i);

  const content = (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      {slides.map((slide, i) => (
        sortableEnabled ? (
          <SortableSlideItem
            key={ids[i]}
            id={ids[i]}
            slide={slide}
            index={i}
            isActive={i === activeIndex}
            onClick={() => onSelect(i)}
            onDuplicate={onDuplicate ? () => onDuplicate(i) : undefined}
            onDelete={onDelete ? () => onDelete(i) : undefined}
          />
        ) : (
          <SlideItemRow
            key={i}
            slide={slide}
            index={i}
            isActive={i === activeIndex}
            onClick={() => onSelect(i)}
          />
        )
      ))}
      {onAdd && (
        <Button
          variant="outline"
          size="sm"
          className="mt-1 w-full border-dashed border-border text-xs hover:border-primary hover:text-primary"
          onClick={onAdd}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Slide
        </Button>
      )}
    </div>
  );

  if (sortableEnabled) {
    return (
      <ScrollArea className="h-full">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      </ScrollArea>
    );
  }

  return <ScrollArea className="h-full">{content}</ScrollArea>;
}

/** Wrapper for non-sortable slide items with the PowerPoint-style row layout */
function SlideItemRow({
  slide,
  index,
  isActive,
  onClick,
}: {
  slide: SlideContent;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md pr-1 transition-all duration-100",
        isActive
          ? "bg-primary/10"
          : "hover:bg-muted/50",
      )}
    >
      {/* Slide number */}
      <div className="flex w-6 shrink-0 items-center justify-center">
        <span className={cn(
          "text-[10px] font-medium tabular-nums",
          isActive ? "text-primary" : "text-muted-foreground",
        )}>
          {index + 1}
        </span>
      </div>

      {/* Active indicator bar */}
      <div className={cn(
        "h-auto self-stretch w-0.75 shrink-0 rounded-full transition-colors duration-100",
        isActive ? "bg-primary" : "bg-transparent group-hover:bg-muted-foreground/30",
      )} />

      {/* Thumbnail */}
      <div className="flex-1 min-w-0 py-0.5">
        <SlideThumbnail
          slide={slide}
          index={index}
          isActive={isActive}
          onClick={onClick}
          hideIndex
        />
      </div>
    </div>
  );
}

function SortableSlideItem({
  id,
  slide,
  index,
  isActive,
  onClick,
  onDuplicate,
  onDelete,
}: {
  id: number;
  slide: SlideContent;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms cubic-bezier(0.25, 1, 0.5, 1)",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-md pr-1 transition-all duration-100",
        isActive
          ? "bg-primary/10"
          : "hover:bg-muted/50",
        isDragging && "z-50",
      )}
    >
      {/* Drag handle + slide number */}
      <div className="flex w-7 shrink-0 flex-col items-center justify-center gap-0.5">
        <button
          className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
          aria-label={`Drag slide ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className={cn(
          "text-[10px] font-medium tabular-nums",
          isActive ? "text-primary" : "text-muted-foreground",
        )}>
          {index + 1}
        </span>
      </div>

      {/* Active indicator bar */}
      <div className={cn(
        "h-auto self-stretch w-0.75 shrink-0 rounded-full transition-colors duration-100",
        isActive ? "bg-primary" : "bg-transparent group-hover:bg-muted-foreground/30",
      )} />

      {/* Thumbnail + hover actions */}
      <div className="relative flex-1 min-w-0 py-0.5">
        <SlideThumbnail
          slide={slide}
          index={index}
          isActive={isActive}
          onClick={onClick}
          hideIndex
        />

        {/* Action buttons — visible on hover, bottom-right of thumbnail */}
        {(onDuplicate || onDelete) && (
          <div className="absolute right-1 bottom-1 flex gap-0.5 opacity-0 transition-all duration-100 group-hover:opacity-100">
            {onDuplicate && (
              <button
                className="rounded bg-black/60 p-0.5 text-white backdrop-blur-sm transition-colors duration-100 hover:bg-black/80"
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                aria-label={`Duplicate slide ${index + 1}`}
              >
                <Copy className="h-2.5 w-2.5" />
              </button>
            )}
            {onDelete && (
              <button
                className="rounded bg-black/60 p-0.5 text-white backdrop-blur-sm transition-colors duration-100 hover:bg-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                aria-label={`Delete slide ${index + 1}`}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
