import { useTranslation } from "react-i18next";
import { Music, BookOpen, Presentation, StickyNote, CalendarClock } from "lucide-react";
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
};

const itemTypeColors: Record<ServiceItemType, string> = {
  hymn: "bg-blue-500",
  bible: "bg-amber-600",
  presentation: "bg-purple-500",
  annotation: "bg-green-500",
  url: "bg-cyan-500",
  file: "bg-gray-500",
  scheduled_category: "bg-rose-500",
};

const itemTypeRingColors: Record<ServiceItemType, string> = {
  hymn: "ring-blue-500/30",
  bible: "ring-amber-600/30",
  presentation: "ring-purple-500/30",
  annotation: "ring-green-500/30",
  url: "ring-cyan-500/30",
  file: "ring-gray-500/30",
  scheduled_category: "ring-rose-500/30",
};

interface ServiceTimelineProps {
  items: ServiceItem[];
  activeIndex?: number;
}

export function ServiceTimeline({ items, activeIndex = -1 }: ServiceTimelineProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">{t("services.noItems")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="relative py-2 pl-5 pr-2">
        {/* Vertical line */}
        <div className="absolute bottom-2 left-[19px] top-2 w-px bg-border" />

        <div className="flex flex-col gap-1">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const isPast = activeIndex >= 0 && index < activeIndex;
            const Icon = itemTypeIcons[item.itemType as ServiceItemType] ?? StickyNote;
            const dotColor = itemTypeColors[item.itemType as ServiceItemType] ?? "bg-gray-500";
            const ringColor = itemTypeRingColors[item.itemType as ServiceItemType] ?? "ring-gray-500/30";

            return (
              <div
                key={item.id}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors",
                  isActive && "bg-primary/10",
                )}
              >
                {/* Dot */}
                <div
                  className={cn(
                    "absolute -left-3 h-2.5 w-2.5 shrink-0 rounded-full",
                    dotColor,
                    isActive && `ring-4 ${ringColor}`,
                    isPast && "opacity-50",
                  )}
                />

                {/* Content */}
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isPast ? "text-muted-foreground/50" : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs font-medium",
                      isActive && "text-primary",
                      isPast && "text-muted-foreground/60",
                    )}
                  >
                    {item.title}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
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
