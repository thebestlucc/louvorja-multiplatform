import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Trash2, Music, BookOpen, Presentation, StickyNote, Monitor, Link2, FileIcon, Pencil, Check, X, CalendarClock, Plus, Video, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";
import { useScheduledMediaItem } from "../../lib/queries";
import type { LiturgyItem, LiturgyItemType, CategoryGroup } from "../../types/liturgy";

const itemTypeIcons: Record<LiturgyItemType, typeof Music> = {
  hymn: Music,
  bible: BookOpen,
  presentation: Presentation,
  annotation: StickyNote,
  url: Link2,
  file: FileIcon,
  scheduled_category: CalendarClock,
  online_video: Video,
  category: CalendarClock,
};

const itemTypeColors: Record<LiturgyItemType, string> = {
  hymn: "text-blue-500",
  bible: "text-amber-600",
  presentation: "text-purple-500",
  annotation: "text-green-500",
  url: "text-cyan-500",
  file: "text-gray-500",
  scheduled_category: "text-rose-500",
  online_video: "text-red-500",
  category: "text-amber-600",
};

const itemTypeDotColors: Record<LiturgyItemType, string> = {
  hymn: "bg-blue-500",
  bible: "bg-amber-600",
  presentation: "bg-purple-500",
  annotation: "bg-green-500",
  url: "bg-cyan-500",
  file: "bg-gray-500",
  scheduled_category: "bg-rose-500",
  online_video: "bg-red-500",
  category: "bg-amber-600",
};

const itemTypeIconBg: Record<LiturgyItemType, string> = {
  hymn: "bg-blue-500/10",
  bible: "bg-amber-500/10",
  presentation: "bg-purple-500/10",
  annotation: "bg-green-500/10",
  url: "bg-cyan-500/10",
  file: "bg-gray-500/10",
  scheduled_category: "bg-rose-500/10",
  online_video: "bg-red-500/10",
  category: "bg-amber-500/10",
};

/** Shorten an absolute file path to `~/rest/of/path` or `.../parent/file.ext` */
function getShortenedPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  // Replace home directory with ~
  const homeRx = /^(\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\/Users\/[^/]+)\//i;
  if (homeRx.test(normalized)) return normalized.replace(homeRx, "~/");
  // Fallback: show last two segments
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length > 2) return "…/" + parts.slice(-2).join("/");
  return normalized;
}

interface LiturgyItemListProps {
  items: LiturgyItem[];
  nestedItems?: CategoryGroup[];
  serviceDate?: string | null;
  activeItemIndex?: number;
  onRemove: (id: number) => void;
  onReorder: (from: number, to: number) => void;
  onProject?: (item: LiturgyItem) => void;
  onEditItem?: (id: number, title: string, notes: string | null) => void;
  onReparent?: (itemId: number, parentId: number | null) => void;
  onReorderByIds?: (newItemIds: number[]) => void;
}

export function LiturgyItemList({ items, nestedItems, serviceDate, activeItemIndex = -1, onRemove, onReorder, onProject, onEditItem, onReparent, onReorderByIds }: LiturgyItemListProps) {
  const { t } = useTranslation();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  // Hover-intent: only reparent after user holds over a category for 300ms
  const [pendingParentId, setPendingParentId] = useState<number | null>(null);
  const reparentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Build a flat list of all items for SortableContext ids
  const allItems = nestedItems
    ? nestedItems.flatMap((group) => [
        ...(group.category ? [group.category] : []),
        ...group.items,
      ])
    : items;

  // Lookup map for item types (used in drag-over detection)
  const itemTypeMap = nestedItems
    ? new Map(allItems.map((item) => [item.id, item.itemType]))
    : null;

  /** Returns the IDs of items that are actually displayed as children of a category.
   * Uses nestedItems (display-order) rather than parentId alone, so "orphaned" items
   * that have a parentId but appear before their category are NOT treated as children. */
  const getDisplayChildIds = (catId: number): number[] => {
    if (nestedItems) {
      const group = nestedItems.find(g => g.category?.id === catId);
      return group ? group.items.map(i => i.id) : [];
    }
    return items.filter(i => i.parentId === catId).map(i => i.id);
  };

  // When a category is being dragged, hide its children from the sortable context
  const hiddenChildIds: Set<number> = activeId !== null && itemTypeMap?.get(activeId) === "category"
    ? new Set(getDisplayChildIds(activeId))
    : new Set<number>();

  const sortableIds = allItems
    .filter(i => {
      // Exclude children of the category currently being dragged
      if (hiddenChildIds.has(i.id)) return false;
      // Exclude children of collapsed categories (they are not visible)
      if (i.parentId !== null && i.parentId !== undefined && collapsedCategories.has(i.parentId)) return false;
      return true;
    })
    .map(i => i.id);

  // Full flat ids for index lookups
  const ids = allItems.map((item) => item.id);

  const toggleCategory = (categoryId: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
    setPendingParentId(null);
    if (reparentTimerRef.current) clearTimeout(reparentTimerRef.current);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over ? Number(event.over.id) : null;
    const overType = overId !== null ? itemTypeMap?.get(overId) : undefined;

    // Cancel any pending reparent timer
    if (reparentTimerRef.current) clearTimeout(reparentTimerRef.current);

    if (overType === "category" && overId !== null) {
      // Start 300ms hover-intent timer — only commit if user holds over the section
      reparentTimerRef.current = setTimeout(() => {
        setPendingParentId(overId);
      }, 300);
    } else {
      // Moved away from category — cancel pending reparent
      setPendingParentId(null);
    }
  };

  /** Compute new flat order when a category (+ children) is dropped at a new position */
  const computeCategoryGroupDrop = (activeCatId: number, overId: number): number[] => {
    const childIds = getDisplayChildIds(activeCatId);
    const groupIds = [activeCatId, ...childIds];
    const groupIdSet = new Set(groupIds);

    // All items except the group being moved
    const rest = allItems.filter(i => !groupIdSet.has(i.id));
    const overIndexInRest = rest.findIndex(i => i.id === overId);

    if (overIndexInRest === -1) {
      // overId is part of the group itself or not found — no change
      return allItems.map(i => i.id);
    }

    // Determine insert direction using original full-array positions
    const activeIndexInFull = allItems.findIndex(i => i.id === activeCatId);
    const overIndexInFull = allItems.findIndex(i => i.id === overId);
    const insertAfter = overIndexInFull > activeIndexInFull;

    const insertAt = insertAfter ? overIndexInRest + 1 : overIndexInRest;

    return [
      ...rest.slice(0, insertAt).map(i => i.id),
      ...groupIds,
      ...rest.slice(insertAt).map(i => i.id),
    ];
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Capture and clear hover-intent state before any returns
    if (reparentTimerRef.current) clearTimeout(reparentTimerRef.current);
    const committedParentId = pendingParentId;
    setActiveId(null);
    setPendingParentId(null);

    if (!over || active.id === over.id) return;

    const activeItemId = Number(active.id);
    const overItemId = Number(over.id);
    const activeType = itemTypeMap?.get(activeItemId);

    // Case: Category drag — move category + all children as group
    if (activeType === "category") {
      const newOrder = computeCategoryGroupDrop(activeItemId, overItemId);
      onReorderByIds?.(newOrder);
      return;
    }

    // Case: Regular item drag — reparent only if hover-intent timer completed
    if (committedParentId !== null && onReparent) {
      const activeItem = items.find(i => i.id === activeItemId);
      const currentParentId = activeItem?.parentId ?? null;
      if (currentParentId !== committedParentId) {
        onReparent(activeItemId, committedParentId);
      }
      return;
    }

    // Default: reorder in place
    const oldIndex = ids.indexOf(activeItemId);
    const newIndex = ids.indexOf(overItemId);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      onReorder(oldIndex, newIndex);
    }
  };

  /** Render the drag overlay preview */
  const renderDragOverlay = () => {
    if (activeId === null) return null;

    const activeItem = items.find(i => i.id === activeId);
    if (!activeItem) return null;

    // Category: show divider + children preview
    if (activeItem.itemType === "category") {
      const childIds = getDisplayChildIds(activeId);
      const children = items.filter(i => childIds.includes(i.id));
      return (
        <div className="opacity-90 rounded-lg bg-surface shadow-lg border border-border p-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-px flex-1 bg-amber-300/50" />
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              {activeItem.title}
            </span>
            <div className="h-px flex-1 bg-amber-300/50" />
          </div>
          {children.length > 0 && (
            <div className="mt-1 space-y-0.5 pl-4">
              {children.map((child) => {
                const Icon = (itemTypeIcons as Record<string, typeof Music>)[child.itemType] ?? CalendarClock;
                const colorClass = (itemTypeColors as Record<string, string>)[child.itemType] ?? "text-gray-500";
                return (
                  <div key={child.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm">
                    <Icon className={cn("h-3.5 w-3.5", colorClass)} />
                    <span className="truncate text-xs text-foreground">{child.title}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Regular item: simplified card
    const Icon = (itemTypeIcons as Record<string, typeof Music>)[activeItem.itemType] ?? CalendarClock;
    const colorClass = (itemTypeColors as Record<string, string>)[activeItem.itemType] ?? "text-gray-500";
    const iconBg = (itemTypeIconBg as Record<string, string>)[activeItem.itemType] ?? "bg-gray-500/10";

    return (
      <div className="opacity-90 flex items-center gap-3 rounded-lg bg-surface shadow-lg border border-border py-2.5 px-3">
        <GripVertical className="h-4 w-4 text-muted-foreground/30" />
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", iconBg)}>
          <Icon className={cn("h-4 w-4", colorClass)} />
        </span>
        <span className="truncate text-sm font-medium text-foreground">{activeItem.title}</span>
      </div>
    );
  };

  if (items.length === 0 && (!nestedItems || nestedItems.length === 0)) {
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

  // Compute a global index counter for nested rendering
  let globalIndex = 0;

  return (
    <ScrollArea className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5 p-3">
            {nestedItems ? (
              nestedItems.map((group, groupIndex) => {
                const categoryId = group.category?.id ?? null;
                const isCollapsed = categoryId !== null && collapsedCategories.has(categoryId);
                const isCategoryBeingDragged = categoryId !== null && activeId === categoryId;

                return (
                  <div key={categoryId ?? `ungrouped-${groupIndex}`}>
                    {/* Category section divider */}
                    {group.category && (
                      <CategoryDivider
                        category={group.category}
                        itemCount={group.items.length}
                        isCollapsed={isCollapsed}
                        isPendingDrop={pendingParentId === categoryId}
                        onToggle={() => toggleCategory(categoryId!)}
                        onRemove={() => onRemove(categoryId!)}
                        onRemoveWithItems={() => {
                          for (const item of group.items) onRemove(item.id);
                          onRemove(categoryId!);
                        }}
                      />
                    )}

                    {/* Child items: hidden when collapsed OR when their parent category is being dragged */}
                    {!isCollapsed && !isCategoryBeingDragged && group.items.map((item) => {
                      // Skip hidden children (already excluded from sortable context)
                      if (hiddenChildIds.has(item.id)) return null;
                      const idx = globalIndex++;
                      return (
                        <SortableLiturgyItem
                          key={item.id}
                          item={item}
                          serviceDate={serviceDate}
                          index={idx}
                          isActive={idx === activeItemIndex}
                          onRemove={() => onRemove(item.id)}
                          onProject={onProject ? () => onProject(item) : undefined}
                          onEditItem={onEditItem}
                        />
                      );
                    })}

                    {/* Skip indices for collapsed or dragged-category items so activeItemIndex stays consistent */}
                    {(isCollapsed || isCategoryBeingDragged) && (() => { globalIndex += group.items.length; return null; })()}
                  </div>
                );
              })
            ) : (
              items.map((item, index) => (
                <SortableLiturgyItem
                  key={item.id}
                  item={item}
                  serviceDate={serviceDate}
                  index={index}
                  isActive={index === activeItemIndex}
                  onRemove={() => onRemove(item.id)}
                  onProject={onProject ? () => onProject(item) : undefined}
                  onEditItem={onEditItem}
                />
              ))
            )}
          </div>
        </SortableContext>

        {createPortal(
          <DragOverlay>
            {activeId !== null && renderDragOverlay()}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </ScrollArea>
  );
}

function CategoryDivider({
  category,
  itemCount,
  isCollapsed,
  isPendingDrop = false,
  onToggle,
  onRemove,
  onRemoveWithItems,
}: {
  category: LiturgyItem;
  itemCount: number;
  isCollapsed: boolean;
  isPendingDrop?: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRemoveWithItems: () => void;
}) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "group relative my-2 flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 transition-all select-none active:cursor-grabbing",
          isPendingDrop && "bg-amber-500/10 ring-1 ring-amber-400/50",
        )}
      >
        {/* Visual drag affordance — always present for discoverability */}
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Left line */}
        <div className="h-px flex-1 bg-amber-300/50" />

        {/* Collapse toggle + title — stop pointer propagation so clicks don't trigger drag */}
        <button
          className="flex items-center gap-1.5 px-2 text-amber-600 transition-colors hover:text-amber-700"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={isCollapsed ? t("services.categories.expand") : t("services.categories.collapse")}
        >
          <ChevronIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">{category.title}</span>
        </button>

        {/* Right line */}
        <div className="h-px flex-1 bg-amber-300/50" />

        {/* Delete section */}
        <button
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 text-muted-foreground/50 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          title={t("actions.delete")}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm p-5">
          <DialogTitle className="text-base font-semibold">
            {t("services.categories.deleteTitle", { title: category.title })}
          </DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("services.categories.deleteDesc")}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
              onClick={() => { onRemove(); setConfirmOpen(false); }}
            >
              {t("services.categories.deleteUngroup")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("services.categories.deleteUngroupDesc")}
              </span>
            </button>
            <button
              className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-destructive px-3 py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              onClick={() => { onRemoveWithItems(); setConfirmOpen(false); }}
            >
              {t("services.categories.deleteWithItems")}
              <span className="text-xs font-normal opacity-80">
                {t("services.categories.deleteWithItemsDesc", { count: itemCount })}
              </span>
            </button>
          </div>

          <button
            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            onClick={() => setConfirmOpen(false)}
          >
            {t("actions.cancel")}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortableLiturgyItem({
  item,
  serviceDate,
  index,
  isActive,
  onRemove,
  onProject,
  onEditItem,
}: {
  item: LiturgyItem;
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
  const dotColor = (itemTypeDotColors as Record<string, string>)[item.itemType] ?? "bg-gray-500";
  const iconBg = (itemTypeIconBg as Record<string, string>)[item.itemType] ?? "bg-gray-500/10";
  const typeLabel = t(`services.itemTypes.${item.itemType}`, item.itemType);
  const isScheduledCategory = item.itemType === "scheduled_category";
  const isChild = item.parentId !== null && item.parentId !== undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg py-2.5 px-3 transition-colors",
        isChild && "ml-4 border-l-2 border-amber-300/30 pl-3",
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50",
      )}
    >
      {/* Drag handle — visible on hover */}
      <button
        className="cursor-grab rounded p-0.5 text-muted-foreground/30 opacity-0 transition-all group-hover:opacity-100 hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Colored type dot */}
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} />

      {/* Track number */}
      <span className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-mono font-bold tabular-nums",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground/50",
      )}>
        {index + 1}
      </span>

      {/* Type icon pill */}
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", iconBg)}>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </span>

      {isEditing ? (
        <div className="min-w-0 flex-1 space-y-1">
          {/* Title row with inline save/cancel */}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              className="min-w-0 flex-1 rounded border border-primary/40 bg-muted/30 px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/40"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") handleCancelEdit();
              }}
            />
            <button
              className="shrink-0 rounded p-1 text-primary transition-colors hover:bg-primary/15"
              onClick={handleSaveEdit}
              title={t("actions.save")}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              className="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              onClick={handleCancelEdit}
              title={t("actions.cancel")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Notes row — lighter visual weight */}
          <input
            className="w-full rounded border border-border/40 bg-transparent px-2 py-0.5 text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            placeholder={t("services.notes")}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p className={cn(
            "truncate text-sm font-medium",
            isActive ? "text-primary" : "text-foreground",
          )}>
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
          {isScheduledCategory ? (
            <ScheduledItemBadge categoryId={item.itemId ?? 0} date={serviceDate ?? null} />
          ) : item.itemType === "file" && item.notes ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/60" title={item.notes}>
              {getShortenedPath(item.notes)}
            </p>
          ) : item.notes ? (
            <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">{item.notes}</p>
          ) : null}
        </div>
      )}

      {/* Action buttons — hover only */}
      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

/** @deprecated Use LiturgyItemList */
export const ServiceItemList = LiturgyItemList;
