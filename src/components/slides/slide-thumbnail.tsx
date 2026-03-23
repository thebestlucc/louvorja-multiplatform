import type { SlideContent } from "../../lib/bindings";
import { SlideRenderer } from "./slide-renderer";
import { cn } from "../../lib/utils";

interface SlideThumbnailProps {
  slide: SlideContent;
  index: number;
  isActive: boolean;
  onClick: () => void;
  /** Optional type label shown as a chip in the top-right corner */
  typeLabel?: string;
}

export function SlideThumbnail({ slide, index, isActive, onClick, typeLabel }: SlideThumbnailProps) {
  return (
    <button
      className={cn(
        "relative block w-full min-w-0 shrink-0 overflow-hidden rounded-lg transition-all duration-150",
        isActive
          ? "ring-2 ring-primary ring-offset-2 ring-offset-surface shadow-md shadow-primary/20"
          : "ring-1 ring-border hover:ring-muted-foreground hover:shadow-sm",
      )}
      onClick={onClick}
      aria-label={`Slide ${index + 1}`}
      aria-current={isActive ? "true" : undefined}
    >
      <div className="aspect-video overflow-hidden rounded-lg bg-black/80">
        <SlideRenderer slide={slide} renderMode="thumbnail" className="h-full w-full scale-100 text-[5px] [&_h1]:!text-[8px] [&_p]:!text-[5px]" />
      </div>
      <div className="absolute bottom-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-tr-md rounded-bl-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {index + 1}
      </div>
      {typeLabel && (
        <div className="absolute top-1 right-1 rounded bg-primary/80 px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
          {typeLabel}
        </div>
      )}
    </button>
  );
}
