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
        "relative block w-full min-w-0 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
        isActive ? "border-primary ring-2 ring-inset ring-primary" : "border-border hover:border-muted-foreground",
      )}
      onClick={onClick}
    >
      <div className="aspect-video overflow-hidden">
        <SlideRenderer slide={slide} renderMode="thumbnail" className="h-full w-full scale-100 text-[5px] [&_h1]:!text-[8px] [&_p]:!text-[5px]" />
      </div>
      <div className="absolute bottom-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded bg-black/60 text-[8px] font-medium text-white">
        {index + 1}
      </div>
    </button>
  );
}
