import { useTranslation } from "react-i18next";
import { catcherSync } from "../../lib/catcher";
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
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Trash2, Music, BookOpen, Presentation, StickyNote, Monitor, Link2, FileIcon, Pencil, CalendarClock, Plus, Video, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";
import { useScheduledMediaItem } from "../../lib/queries";
import { AddItemModal } from "./add-item-modal";
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

/** Parse online_video notes JSON and return a display string (e.g. "Channel · 4:33"). */
function getVideoSubtitle(notes: string): string | null {
  const [d] = catcherSync(() => JSON.parse(notes) as { channelName?: string; duration?: string });
  if (!d) return null;
  const parts = [d.channelName, d.duration].filter((v): v is string => !!v);
  return parts.length > 0 ? parts.join(" · ") : null;
}

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
  serviceId: number;
  serviceDate?: string | null;
  activeItemIndex?: number;
  onRemove: (id: number) => void;
  onProject?: (item: LiturgyItem) => void;
  onEditItem?: (id: number, title: string, notes: string | null) => void;
  /** Single drop handler: receives the item id, its new parentId (null = top-level), and the full new flat order */
  onDrop?: (itemId: number, newParentId: number | null, newOrderIds: number[]) => void;
}

export function LiturgyItemList({ items, nestedItems, serviceId, serviceDate, activeItemIndex = -1, onRemove, onProject, onEditItem, onDrop }: LiturgyItemListProps) {
  const { t } = useTranslation();
  const [editingItem, setEditingItem] = useState<LiturgyItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  // Hover-intent: reparent after user holds over a category for 400ms
  const [pendingParentId, setPendingParentId] = useState<number | null>(null);
  const reparentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedParentIdRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Gap slot helpers — virtual droppables inserted after each section
  const GAP_PREFIX = "gap-";
  const isGapId = (id: string | number): boolean => String(id).startsWith(GAP_PREFIX);
  const catIdFromGap = (gapId: string) => parseInt(gapId.slice(GAP_PREFIX.length), 10);

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

  /** Returns the IDs of items that are actually displayed as children of a category. */
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

  // Build sortable IDs including gap slots after each section
  const sortableIds: (number | string)[] = [];
  if (nestedItems) {
    for (const group of nestedItems) {
      const catId = group.category?.id ?? null;
      if (catId !== null) {
        if (!hiddenChildIds.has(catId)) {
          sortableIds.push(catId);
          if (!collapsedCategories.has(catId) && activeId !== catId) {
            for (const item of group.items) {
              if (!hiddenChildIds.has(item.id)) sortableIds.push(item.id);
            }
          }
          // Gap slot after the section — gives a droppable target for "insert after section"
          if (activeId !== catId) sortableIds.push(`${GAP_PREFIX}${catId}`);
        }
      } else {
        for (const item of group.items) {
          if (!hiddenChildIds.has(item.id) &&
              !(item.parentId != null && collapsedCategories.has(item.parentId))) {
            sortableIds.push(item.id);
          }
        }
      }
    }
  } else {
    sortableIds.push(...allItems.map(i => i.id));
  }


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
    committedParentIdRef.current = null;
    if (reparentTimerRef.current) clearTimeout(reparentTimerRef.current);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const rawOverId = event.over?.id;
    const overId = rawOverId != null && !isGapId(rawOverId) ? Number(rawOverId) : null;
    const overType = overId !== null ? itemTypeMap?.get(overId) : undefined;

    // Resolve the target category: either the hovered category header itself,
    // or the parent category of the hovered child item (so intent triggers over the whole section area).
    const overItem = overId !== null ? allItems.find(i => i.id === overId) : null;
    const targetCategoryId: number | null =
      overType === "category" ? overId :
      (overItem?.parentId ?? null);

    // Skip hover-intent if the dragged item is already in this category (reorder, not reparent)
    const activeItem = activeId !== null ? allItems.find(i => i.id === activeId) : null;
    const alreadyInSection = targetCategoryId !== null && activeItem?.parentId === targetCategoryId;

    if (targetCategoryId !== null && !alreadyInSection) {
      // Cancel any previous timer (different category or restart)
      if (reparentTimerRef.current) clearTimeout(reparentTimerRef.current);
      // Already committed to THIS category — nothing to do
      if (pendingParentId === targetCategoryId) return;
      // Moving to a different/new category — reset and start new timer
      setPendingParentId(null);
      const captured = targetCategoryId;
      reparentTimerRef.current = setTimeout(() => {
        setPendingParentId(captured);           // visual
        committedParentIdRef.current = captured; // for handleDragEnd (always fresh)
        reparentTimerRef.current = null;
      }, 150);
    } else {
      // Moved outside any section (or into own section) — cancel pending intent
      if (reparentTimerRef.current !== null) {
        clearTimeout(reparentTimerRef.current);
        reparentTimerRef.current = null;
        committedParentIdRef.current = null;
        setPendingParentId(null);
      }
      // If ref is already null, timer already fired and intent is committed — keep pendingParentId
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

    if (reparentTimerRef.current) clearTimeout(reparentTimerRef.current);
    const committedParentId = committedParentIdRef.current; // ref: always fresh, not stale closure
    committedParentIdRef.current = null;
    setActiveId(null);
    setPendingParentId(null);

    if (!over || active.id === over.id || !onDrop) return;

    const activeItemId = Number(active.id);
    const activeType = itemTypeMap?.get(activeItemId);
    const activeItem = items.find(i => i.id === activeItemId);

    // Helper: splice flat items array to produce new order ids
    const reorderedIds = (targetId: number): number[] | null => {
      const oldIndex = allItems.findIndex(i => i.id === activeItemId);
      const newIndex = allItems.findIndex(i => i.id === targetId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;
      const next = allItems.map(i => i.id);
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    };

    // Case: gap drop → place after section, unparent
    if (isGapId(over.id)) {
      const catId = catIdFromGap(String(over.id));
      const group = nestedItems?.find(g => g.category?.id === catId);
      // Use the last child as anchor, but if that IS the item being dragged
      // (i.e. it's the only/last item in the section), fall back to the category header.
      const lastChild = group && group.items.length > 0 ? group.items[group.items.length - 1] : null;
      const anchorId = (lastChild && lastChild.id !== activeItemId) ? lastChild.id : catId;

      if (activeType === "category") {
        onDrop(activeItemId, activeItem?.parentId ?? null, computeCategoryGroupDrop(activeItemId, anchorId));
        return;
      }

      const withoutActive = allItems.filter(i => i.id !== activeItemId);
      const anchorIndex = withoutActive.findIndex(i => i.id === anchorId);
      if (anchorIndex !== -1) {
        const newOrder = [
          ...withoutActive.slice(0, anchorIndex + 1).map(i => i.id),
          activeItemId,
          ...withoutActive.slice(anchorIndex + 1).map(i => i.id),
        ];
        onDrop(activeItemId, null, newOrder);
      }
      return;
    }

    const overItemId = Number(over.id);

    // Case: category group drag
    if (activeType === "category") {
      onDrop(activeItemId, activeItem?.parentId ?? null, computeCategoryGroupDrop(activeItemId, overItemId));
      return;
    }

    // Case: hover-intent reparent → insert at the visual drop position within the section
    if (committedParentId !== null) {
      const currentParentId = activeItem?.parentId ?? null;
      if (currentParentId !== committedParentId) {
        // Use reorderedIds to honour the exact position where the user dropped
        const newOrder = reorderedIds(overItemId);
        if (newOrder) onDrop(activeItemId, committedParentId, newOrder);
      }
      return;
    }

    // Dropped on a category header without hover-intent → place the item before the section (unparented)
    const overType = itemTypeMap?.get(overItemId);
    if (overType === "category") {
      const withoutActive = allItems.filter(i => i.id !== activeItemId);
      const catIndex = withoutActive.findIndex(i => i.id === overItemId);
      if (catIndex !== -1 && onDrop) {
        const newOrder = [
          ...withoutActive.slice(0, catIndex).map(i => i.id),
          activeItemId,
          ...withoutActive.slice(catIndex).map(i => i.id),
        ];
        onDrop(activeItemId, null, newOrder);
      }
      return;
    }

    // Determine new parent:
    //   - dropped onto a top-level item → unparent (drag out of section)
    //   - dropped onto a child of a DIFFERENT section → reparent to that section
    //   - otherwise → keep current parent (same-section reorder)
    const overItem = allItems.find(i => i.id === overItemId);
    const newParentId: number | null = (() => {
      if (activeItem?.parentId == null) return null; // was already top-level
      if (overItem?.parentId == null) return null;   // over a top-level item → unparent
      if (activeItem.parentId !== overItem.parentId) return overItem.parentId; // cross-section
      return activeItem.parentId; // same-section reorder
    })();

    // Default: reorder (includes cross-section reorder)
    const newOrder = reorderedIds(overItemId);
    if (newOrder) onDrop(activeItemId, newParentId, newOrder);
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
        <div className="opacity-90 rounded-lg bg-card shadow-lg border border-border p-2">
          <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1.5">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30" />
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
              {activeItem.title}
            </span>
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
                  <div key={categoryId ?? `ungrouped-${groupIndex}`} className={group.category ? "mt-3 mb-1" : undefined}>
                    {/* Category section divider */}
                    {group.category && (
                      <CategoryDivider
                        category={group.category}
                        itemCount={group.items.length}
                        isCollapsed={isCollapsed}
                        isPendingDrop={pendingParentId === categoryId}
                        suppressTransform={activeId !== null && itemTypeMap?.get(activeId) !== "category"}
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
                          onOpenEdit={onEditItem ? () => setEditingItem(item) : undefined}
                        />
                      );
                    })}

                    {/* Skip indices for collapsed or dragged-category items so activeItemIndex stays consistent */}
                    {(isCollapsed || isCategoryBeingDragged) && (() => { globalIndex += group.items.length; return null; })()}

                    {/* Gap slot: droppable area after the section, allows placing items after it */}
                    {categoryId !== null && !isCategoryBeingDragged && (
                      <SortableGap id={`${GAP_PREFIX}${categoryId}`} isDragging={activeId !== null} />
                    )}
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
                  onOpenEdit={onEditItem ? () => setEditingItem(item) : undefined}
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

      {editingItem && (
        <AddItemModal
          open={editingItem !== null}
          onOpenChange={(o) => { if (!o) setEditingItem(null); }}
          serviceId={serviceId}
          onAdd={() => {}}
          editItem={editingItem}
          onEdit={(id, title, notes) => {
            onEditItem?.(id, title, notes);
            setEditingItem(null);
          }}
          onRemoveItem={onRemove}
        />
      )}
    </ScrollArea>
  );
}

/** Droppable gap rendered after each section — gives a clear drop target for "insert after section" */
function SortableGap({ id, isDragging }: { id: string; isDragging: boolean }) {
  const { setNodeRef, isOver } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="h-2 mx-2">
      {isDragging && isOver && (
        <div className="h-0.5 w-full rounded-full bg-primary/60" />
      )}
    </div>
  );
}

function CategoryDivider({
  category,
  itemCount,
  isCollapsed,
  isPendingDrop = false,
  suppressTransform = false,
  onToggle,
  onRemove,
  onRemoveWithItems,
}: {
  category: LiturgyItem;
  itemCount: number;
  isCollapsed: boolean;
  isPendingDrop?: boolean;
  suppressTransform?: boolean;
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
    transform: suppressTransform ? undefined : CSS.Transform.toString(transform),
    transition: suppressTransform ? undefined : transition,
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
          "group relative flex cursor-grab items-center gap-2 rounded-lg pl-3 pr-2 py-2 transition-all select-none active:cursor-grabbing",
          isPendingDrop
            ? "bg-primary/8 ring-1 ring-primary/30"
            : "bg-muted/40 hover:bg-muted/60",
        )}
      >
        {/* Left accent bar */}
        <div className={cn(
          "absolute left-0 top-1 bottom-1 w-0.75 rounded-full transition-colors",
          isPendingDrop ? "bg-primary/60" : "bg-foreground/15 group-hover:bg-foreground/25",
        )} />

        {/* Drag handle */}
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Collapse toggle + title */}
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 text-foreground/70 transition-colors hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={isCollapsed ? t("services.categories.expand") : t("services.categories.collapse")}
        >
          <ChevronIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs font-semibold uppercase tracking-wider">{category.title}</span>
        </button>

        {/* Item count badge */}
        {itemCount > 0 && (
          <span className="shrink-0 rounded-full bg-foreground/8 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground/70">
            {itemCount}
          </span>
        )}

        {/* Delete */}
        <button
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 text-muted-foreground/50 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); if (itemCount === 0) { onRemove(); } else { setConfirmOpen(true); } }}
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
  serviceDate: _serviceDate,
  index,
  isActive,
  onRemove,
  onProject,
  onOpenEdit,
}: {
  item: LiturgyItem;
  serviceDate?: string | null;
  index: number;
  isActive: boolean;
  onRemove: () => void;
  onProject?: () => void;
  onOpenEdit?: () => void;
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

  const Icon = (itemTypeIcons as Record<string, typeof Music>)[item.itemType] ?? CalendarClock;
  const colorClass = (itemTypeColors as Record<string, string>)[item.itemType] ?? "text-gray-500";
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
        isChild && "ml-5 pl-3",
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50",
      )}
    >
      {/* Left indent connector for child items */}
      {isChild && (
        <div className="pointer-events-none absolute -left-5 top-0 bottom-0 flex items-stretch">
          <div className="w-0.5 self-stretch bg-border/50" />
        </div>
      )}

      {/* Drag handle — visible on hover */}
      <button
        className="cursor-grab rounded p-0.5 text-muted-foreground/30 opacity-0 transition-all group-hover:opacity-100 hover:text-foreground"
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

      {/* Type icon pill */}
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", iconBg)}>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </span>

      <div className="min-w-0 flex-1">
          <p className={cn(
            "truncate text-sm font-medium",
            isActive ? "text-primary" : "text-foreground",
          )}>
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
          {isScheduledCategory ? (
            <ScheduledItemBadge categoryId={item.itemId ?? 0} date={new Date().toISOString().slice(0, 10)} />
          ) : item.itemType === "file" && item.notes ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/60" title={item.notes}>
              {getShortenedPath(item.notes)}
            </p>
          ) : item.itemType === "online_video" && item.notes ? (
            (() => {
              const sub = getVideoSubtitle(item.notes);
              return sub ? (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/60">{sub}</p>
              ) : null;
            })()
          ) : item.itemType !== "online_video" && item.notes ? (
            <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">{item.notes}</p>
          ) : null}
      </div>

      {/* Action buttons — hover only */}
      {(
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
          {onOpenEdit && (
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onOpenEdit}
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
      <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">
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
