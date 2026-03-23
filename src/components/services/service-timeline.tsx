import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { Music, BookOpen, Presentation, StickyNote, CalendarClock, Check, Video } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ServiceItem, ServiceItemType } from "../../types/service";
import { ScrollArea } from "../ui/scroll-area";

const itemTypeIcons: Record<ServiceItemType, typeof Music> = {
  hymn: Music,
  bible: BookOpen,
  presentation: Presentation,
  annotation: StickyNote,
  url: StickyNote,
  file: StickyNote,
  scheduled_category: CalendarClock,
  online_video: Video,
};

const itemTypeColors: Record<ServiceItemType, string> = {
  hymn: "bg-blue-500",
  bible: "bg-amber-600",
  presentation: "bg-purple-500",
  annotation: "bg-green-500",
  url: "bg-cyan-500",
  file: "bg-gray-500",
  scheduled_category: "bg-rose-500",
  online_video: "bg-red-500",
};

const itemTypeRingColors: Record<ServiceItemType, string> = {
  hymn: "ring-blue-500/30",
  bible: "ring-amber-600/30",
  presentation: "ring-purple-500/30",
  annotation: "ring-green-500/30",
  url: "ring-cyan-500/30",
  file: "ring-gray-500/30",
  scheduled_category: "ring-rose-500/30",
  online_video: "ring-red-500/30",
};

const itemTypeTextColors: Record<ServiceItemType, string> = {
  hymn: "text-blue-500",
  bible: "text-amber-600",
  presentation: "text-purple-500",
  annotation: "text-green-500",
  url: "text-cyan-500",
  file: "text-gray-500",
  scheduled_category: "text-rose-500",
  online_video: "text-red-500",
};

interface ServiceTimelineProps {
  items: ServiceItem[];
  activeIndex?: number;
}

export function ServiceTimeline({ items, activeIndex = -1 }: ServiceTimelineProps) {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to active item
  useEffect(() => {
    if (activeIndex >= 0 && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-xs text-muted-foreground/60">{t("services.noItems")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="relative py-4 pl-7 pr-3">
        {/* Vertical connector line (dashed) */}
        <div className="absolute bottom-4 left-[21px] top-4 w-0 border-l-2 border-dashed border-border/50" />

        <div className="flex flex-col gap-0.5">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const isPast = activeIndex >= 0 && index < activeIndex;
            const Icon = itemTypeIcons[item.itemType as ServiceItemType] ?? StickyNote;
            const dotColor = itemTypeColors[item.itemType as ServiceItemType] ?? "bg-gray-500";
            const ringColor = itemTypeRingColors[item.itemType as ServiceItemType] ?? "ring-gray-500/30";
            const textColor = itemTypeTextColors[item.itemType as ServiceItemType] ?? "text-gray-500";

            return (
              <div
                key={item.id}
                ref={isActive ? activeRef : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                  isActive && "bg-primary/8 shadow-md",
                  isPast && "opacity-50",
                )}
              >
                {/* Timeline indicator */}
                <div
                  className={cn(
                    "absolute -left-4 flex shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    isActive
                      ? `h-6 w-6 ring-4 ${ringColor} ${dotColor} animate-pulse shadow-lg`
                      : isPast
                        ? "h-4 w-4 bg-muted-foreground/30"
                        : `h-3 w-3 ${dotColor}`,
                  )}
                >
                  {isPast && (
                    <Check className="h-2.5 w-2.5 text-background" />
                  )}
                  {isActive && (
                    <div className="h-2.5 w-2.5 rounded-full bg-background" />
                  )}
                </div>

                {/* Icon */}
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isActive
                      ? textColor
                      : isPast
                        ? "text-muted-foreground/30"
                        : "text-muted-foreground/60",
                  )}
                />

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs transition-colors",
                      isActive
                        ? "font-semibold text-primary"
                        : isPast
                          ? "font-normal text-muted-foreground/40 line-through"
                          : "font-medium text-foreground",
                    )}
                  >
                    {item.title}
                  </p>
                </div>

                {/* Index badge */}
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : isPast
                      ? "text-muted-foreground/30"
                      : "text-muted-foreground/50",
                )}>
                  {index + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
