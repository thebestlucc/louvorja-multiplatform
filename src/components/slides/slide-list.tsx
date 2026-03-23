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
    <div ref={containerRef} className="flex flex-col gap-2 p-1 pr-3">
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
          <SlideThumbnail
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
          className="mt-2 w-full border-dashed border-border hover:border-primary hover:text-primary"
          onClick={onAdd}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
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
        "group relative w-full min-w-0",
        isDragging && "z-50",
      )}
    >
      <SlideThumbnail
        slide={slide}
        index={index}
        isActive={isActive}
        onClick={onClick}
      />

      {/* Drag handle — visible on hover, left margin */}
      <button
        className="pointer-events-none absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-md bg-surface p-1 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition-all duration-150 hover:bg-surface-hover hover:text-foreground group-hover:pointer-events-auto group-hover:opacity-100"
        aria-label={`Drag slide ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Action buttons — visible on hover, right side */}
      {(onDuplicate || onDelete) && (
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-all duration-150 group-hover:opacity-100">
          {onDuplicate && (
            <button
              className="rounded-md bg-black/60 p-1 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-black/80"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              aria-label={`Duplicate slide ${index + 1}`}
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              className="rounded-md bg-black/60 p-1 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label={`Delete slide ${index + 1}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
