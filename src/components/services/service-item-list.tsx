import { useTranslation } from "react-i18next";
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
import { GripVertical, Trash2, Music, BookOpen, Presentation, StickyNote } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import type { ServiceItem, ServiceItemType } from "../../types/service";

const itemTypeIcons: Record<ServiceItemType, typeof Music> = {
  hymn: Music,
  bible: BookOpen,
  presentation: Presentation,
  annotation: StickyNote,
  url: StickyNote,
  file: StickyNote,
};

const itemTypeColors: Record<ServiceItemType, string> = {
  hymn: "text-blue-500",
  bible: "text-amber-600",
  presentation: "text-purple-500",
  annotation: "text-green-500",
  url: "text-cyan-500",
  file: "text-gray-500",
};

interface ServiceItemListProps {
  items: ServiceItem[];
  onRemove: (id: number) => void;
  onReorder: (from: number, to: number) => void;
}

export function ServiceItemList({ items, onRemove, onReorder }: ServiceItemListProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map((item) => item.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(Number(active.id));
      const newIndex = ids.indexOf(Number(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{t("services.noItems")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-0.5 p-2">
            {items.map((item, index) => (
              <SortableServiceItem
                key={item.id}
                item={item}
                index={index}
                onRemove={() => onRemove(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </ScrollArea>
  );
}

function SortableServiceItem({
  item,
  index,
  onRemove,
}: {
  item: ServiceItem;
  index: number;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
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
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = itemTypeIcons[item.itemType as ServiceItemType] ?? StickyNote;
  const colorClass = itemTypeColors[item.itemType as ServiceItemType] ?? "text-gray-500";
  const typeLabel = t(`services.itemTypes.${item.itemType}`, item.itemType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-md border border-border bg-surface p-2 transition-colors hover:bg-surface-hover"
    >
      <button
        className="cursor-grab p-0.5 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-muted-foreground">
        {index + 1}
      </span>

      <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{typeLabel}</p>
      </div>

      <button
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
