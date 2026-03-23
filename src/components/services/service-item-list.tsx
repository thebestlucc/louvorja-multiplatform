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
import { useState, useRef, useEffect } from "react";
import { GripVertical, Trash2, Music, BookOpen, Presentation, StickyNote, Monitor, Link2, FileIcon, Pencil, Check, X, CalendarClock, Plus, Video } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { useScheduledMediaItem } from "../../lib/queries";
import type { ServiceItem, ServiceItemType } from "../../types/service";

const itemTypeIcons: Record<ServiceItemType, typeof Music> = {
  hymn: Music,
  bible: BookOpen,
  presentation: Presentation,
  annotation: StickyNote,
  url: Link2,
  file: FileIcon,
  scheduled_category: CalendarClock,
  online_video: Video,
};

const itemTypeColors: Record<ServiceItemType, string> = {
  hymn: "text-blue-500",
  bible: "text-amber-600",
  presentation: "text-purple-500",
  annotation: "text-green-500",
  url: "text-cyan-500",
  file: "text-gray-500",
  scheduled_category: "text-rose-500",
  online_video: "text-red-500",
};

const itemTypeBorders: Record<ServiceItemType, string> = {
  hymn: "border-l-blue-500",
  bible: "border-l-amber-600",
  presentation: "border-l-purple-500",
  annotation: "border-l-green-500",
  url: "border-l-cyan-500",
  file: "border-l-gray-500",
  scheduled_category: "border-l-rose-500",
  online_video: "border-l-red-500",
};

interface ServiceItemListProps {
  items: ServiceItem[];
  serviceDate?: string | null;
  activeItemIndex?: number;
  onRemove: (id: number) => void;
  onReorder: (from: number, to: number) => void;
  onProject?: (item: ServiceItem) => void;
  onEditItem?: (id: number, title: string, notes: string | null) => void;
}

export function ServiceItemList({ items, serviceDate, activeItemIndex = -1, onRemove, onReorder, onProject, onEditItem }: ServiceItemListProps) {
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
      <div className="flex h-full flex-col items-center justify-center gap-4 p-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
          <Plus className="h-6 w-6 text-primary/30" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{t("services.noItems")}</p>
        </div>
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
          <div className="flex flex-col gap-1.5 p-3">
            {items.map((item, index) => (
              <SortableServiceItem
                key={item.id}
                item={item}
                serviceDate={serviceDate}
                index={index}
                isActive={index === activeItemIndex}
                onRemove={() => onRemove(item.id)}
                onProject={onProject ? () => onProject(item) : undefined}
                onEditItem={onEditItem}
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
  serviceDate,
  index,
  isActive,
  onRemove,
  onProject,
  onEditItem,
}: {
  item: ServiceItem;
  serviceDate?: string | null;
  index: number;
  isActive: boolean;
  onRemove: () => void;
  onProject?: () => void;
  onEditItem?: (id: number, title: string, notes: string | null) => void;
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    if (editTitle.trim() && onEditItem) {
      onEditItem(item.id, editTitle.trim(), editNotes.trim() || null);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(item.title);
    setEditNotes(item.notes ?? "");
    setIsEditing(false);
  };

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

  const Icon = (itemTypeIcons as Record<string, typeof Music>)[item.itemType] ?? CalendarClock;
  const colorClass = (itemTypeColors as Record<string, string>)[item.itemType] ?? "text-gray-500";
  const borderClass = (itemTypeBorders as Record<string, string>)[item.itemType] ?? "border-l-gray-500";
  const typeLabel = t(`services.itemTypes.${item.itemType}`, item.itemType);
  const isScheduledCategory = item.itemType === "scheduled_category";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex min-h-[60px] cursor-pointer items-center gap-3 rounded-lg border-l-4 bg-surface px-3 py-3 transition-all duration-150",
        borderClass,
        isActive
          ? "bg-primary/8 shadow-sm ring-1 ring-primary/20"
          : "hover:bg-surface-hover hover:shadow-sm",
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground group-hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Track number */}
      <span className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-mono font-bold tabular-nums",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground/50",
      )}>
        {index + 1}
      </span>

      {isEditing ? (
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            ref={inputRef}
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
          <input
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={t("services.notes")}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
          <div className="flex gap-1">
            <button
              className="rounded-md p-1 text-primary hover:bg-primary/10 transition-colors"
              onClick={handleSaveEdit}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
              onClick={handleCancelEdit}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Type icon pill */}
            <span className={cn("flex items-center gap-1 text-xs", colorClass)}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">{typeLabel}</span>
            </span>
            <p className={cn(
              "truncate text-sm font-semibold",
              isActive ? "text-primary" : "text-foreground",
            )}>
              {item.title}
            </p>
          </div>
          {isScheduledCategory ? (
            <ScheduledItemBadge categoryId={item.itemId ?? 0} date={serviceDate ?? null} />
          ) : item.notes ? (
            <p className="mt-1 truncate text-xs italic text-muted-foreground/60">{item.notes}</p>
          ) : null}
        </div>
      )}

      {/* Action buttons - revealed on hover */}
      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 transition-all duration-150 group-hover:opacity-100">
          {onProject && (
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              onClick={onProject}
              title={t("services.projectItem")}
            >
              <Monitor className="h-4 w-4" />
            </button>
          )}
          {onEditItem && (
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              onClick={() => setIsEditing(true)}
              title={t("services.editItem")}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduledItemBadge({ categoryId, date }: { categoryId: number; date: string | null }) {
  const { data: mediaItem, isLoading } = useScheduledMediaItem(categoryId, date);
  const { t } = useTranslation();

  if (isLoading) return <span className="text-[10px] text-muted-foreground animate-pulse mt-0.5">...</span>;

  if (!mediaItem) {
    return (
      <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px] border-destructive/30 text-destructive bg-destructive/5">
        {t("mediaLibrary.noItemOnDate", "No item for this date")}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-primary/30 text-primary bg-primary/5">
        {mediaItem.name}
      </Badge>
      <span className="text-[10px] font-medium uppercase text-muted-foreground/60">{mediaItem.fileType}</span>
    </div>
  );
}
