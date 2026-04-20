import { useTranslation } from "react-i18next";
import { useState } from "react";
import { GripVertical, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";
import type { LiturgyItem } from "../../types/liturgy";

export function CategoryDivider({
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
