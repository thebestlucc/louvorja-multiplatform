"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PanelRightClose,
  PanelRight,
  Music,
  Video,
  BookOpen,
  FileText,
  Image,
  Presentation,
  X,
  GripVertical,
} from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { getPreference, setPreference } from "../../lib/store";
import { cn } from "../../lib/utils";
import { useQueueStore, type QueueItem } from "../../stores/queue-store";

interface QueuePanelProps {
  className?: string;
}

const PREF_KEY = "playing-now-queue-panel-collapsed";

const typeIcons: Record<string, typeof Music> = {
  audio: Music,
  playback: Music,
  projection: Presentation,
  online_video: Video,
  offline_video: Video,
  image: Image,
  bible: BookOpen,
  annotation: FileText,
};

function getItemTitle(item: QueueItem): string {
  if (item.title) return item.title;
  if (item.hymn) return item.hymn.title;
  return "Untitled";
}

function getItemSubtitle(item: QueueItem): string | null {
  if (item.hymn?.album) return item.hymn.album;
  return null;
}

export function QueuePanel({ className }: QueuePanelProps) {
  const { t } = useTranslation();
  const items = useQueueStore((s) => s.items);
  const currentIndex = useQueueStore((s) => s.currentIndex);
  const setCurrentIndex = useQueueStore((s) => s.setCurrentIndex);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getPreference(PREF_KEY, false).then(setCollapsed);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPreference(PREF_KEY, next);
  };

  if (collapsed) {
    return (
      <div
        className={cn(
          "flex h-full w-10 flex-col items-center border-l border-border bg-muted/30 pt-2",
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleCollapsed}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
        <div className="mt-2 -rotate-90 whitespace-nowrap text-xs text-muted-foreground">
          {t("playingNow.queue")} ({items.length})
        </div>
      </div>
    );
  }

  const nowPlaying = currentIndex >= 0 ? items[currentIndex] : null;
  const upNext = items.filter((_, i) => i > currentIndex);

  return (
    <div
      className={cn(
        "flex h-full w-[280px] min-w-[220px] max-w-[400px] flex-col border-l border-border bg-muted/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("playingNow.queue")} ({items.length})
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleCollapsed}
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {/* Now Playing */}
          {nowPlaying && (
            <>
              <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("playingNow.nowPlaying")}
              </div>
              <QueueItemRow
                item={nowPlaying}
                isActive
                onRemove={undefined}
                onClick={undefined}
              />
            </>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <>
              <div className="mt-2 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("playingNow.nextUp")} ({upNext.length})
              </div>
              {upNext.map((item, i) => {
                const actualIndex = currentIndex + 1 + i;
                return (
                  <QueueItemRow
                    key={item.id}
                    item={item}
                    isActive={false}
                    onClick={() => setCurrentIndex(actualIndex)}
                    onRemove={() => removeFromQueue(actualIndex)}
                  />
                );
              })}
            </>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <Music className="mb-2 h-8 w-8 opacity-40" />
              {t("playingNow.emptyQueue")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function QueueItemRow({
  item,
  isActive,
  onClick,
  onRemove,
}: {
  item: QueueItem;
  isActive: boolean;
  onClick: (() => void) | undefined;
  onRemove: (() => void) | undefined;
}) {
  const Icon = typeIcons[item.type] ?? Music;
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        isActive
          ? "bg-primary/10 text-primary"
          : "cursor-pointer hover:bg-accent"
      )}
      onClick={onClick}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/40" />
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-tight">{title}</div>
        {subtitle && (
          <div className="truncate text-[11px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
