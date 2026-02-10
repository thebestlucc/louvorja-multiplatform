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
import type { SlideContent } from "../../types/presentation";
import { SlideThumbnail } from "./slide-thumbnail";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";

interface SlideListProps {
  slides: SlideContent[];
  activeIndex: number;
  onSelect: (index: number) => void;
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
}

export function SlideList({
  slides,
  activeIndex,
  onSelect,
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
  }, [activeIndex, slides.length, onSelect]);

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
    <div ref={containerRef} className="flex flex-col gap-1.5 p-2">
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
          className="mt-1 w-full"
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
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="flex items-start gap-1">
        <button
          className="mt-3 cursor-grab p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <div className="flex-1">
          <SlideThumbnail
            slide={slide}
            index={index}
            isActive={isActive}
            onClick={onClick}
          />
        </div>
      </div>

      {(onDuplicate || onDelete) && (
        <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onDuplicate && (
            <button
              className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              className="rounded bg-black/60 p-1 text-white hover:bg-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
