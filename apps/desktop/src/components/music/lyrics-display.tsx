import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import type { VisibleHymnLyricItem } from "../../lib/hymn-slides";

interface LyricsDisplayProps {
  items: VisibleHymnLyricItem[];
  activeSlideIndex: number;
  onStanzaClick?: (slideIndex: number) => void;
}

export function LyricsDisplay({ items, activeSlideIndex, onStanzaClick }: LyricsDisplayProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeSlideIndex]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No lyrics available</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.slideIndex}
          ref={item.slideIndex === activeSlideIndex ? activeRef : undefined}
          className={cn(
            "cursor-pointer rounded-md border p-3 text-sm transition-colors",
            item.slideIndex === activeSlideIndex
              ? "border-primary bg-primary/10 text-foreground"
              : "border-transparent text-muted-foreground hover:bg-surface-hover",
          )}
          onClick={() => onStanzaClick?.(item.slideIndex)}
        >
          <p className="whitespace-pre-line">{item.text}</p>
        </div>
      ))}
    </div>
  );
}
