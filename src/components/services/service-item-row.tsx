import { useTranslation } from "react-i18next";
import { GripVertical, Trash2, Music, BookOpen, Presentation, StickyNote, Monitor, Link2, FileIcon, Pencil, CalendarClock, Video } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { catcherSync } from "../../lib/catcher";
import { useScheduledMediaItem } from "../../lib/queries";
import type { LiturgyItem, LiturgyItemType } from "../../types/liturgy";

export const itemTypeIcons: Record<LiturgyItemType, typeof Music> = {
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

export const itemTypeColors: Record<LiturgyItemType, string> = {
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

export const itemTypeIconBg: Record<LiturgyItemType, string> = {
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
export function getVideoSubtitle(notes: string): string | null {
  const [d] = catcherSync(() => JSON.parse(notes) as { channelName?: string; duration?: string });
  if (!d) return null;
  const parts = [d.channelName, d.duration].filter((v): v is string => !!v);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Shorten an absolute file path to `~/rest/of/path` or `.../parent/file.ext` */
export function getShortenedPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  // Replace home directory with ~
  const homeRx = /^(\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\/Users\/[^/]+)\//i;
  if (homeRx.test(normalized)) return normalized.replace(homeRx, "~/");
  // Fallback: show last two segments
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length > 2) return "…/" + parts.slice(-2).join("/");
  return normalized;
}

export function SortableLiturgyItem({
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

export function ScheduledItemBadge({ categoryId, date }: { categoryId: number; date: string | null }) {
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
