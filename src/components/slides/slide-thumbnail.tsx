import type { SlideContent } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import { cn } from "../../lib/utils";

interface SlideThumbnailProps {
  slide: SlideContent;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

export function SlideThumbnail({ slide, index, isActive, onClick }: SlideThumbnailProps) {
  return (
    <button
      className={cn(
        "relative w-40 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
        isActive ? "border-primary ring-2 ring-primary" : "border-border hover:border-muted-foreground",
      )}
      onClick={onClick}
    >
      <div className="aspect-video">
        <SlideRenderer slide={slide} className="h-full w-full text-[6px]" />
      </div>
      <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[10px] font-medium text-white">
        {index + 1}
      </div>
    </button>
  );
}
