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
  /** Hide the slide number overlay (when number is shown externally) */
  hideIndex?: boolean;
}

export function SlideThumbnail({ slide, index, isActive, onClick, typeLabel, hideIndex }: SlideThumbnailProps) {
  return (
    <button
      className={cn(
        "relative block w-full min-w-0 shrink-0 overflow-hidden rounded transition-all duration-100",
        isActive
          ? "ring-2 ring-primary shadow-md shadow-primary/15"
          : "ring-1 ring-border hover:ring-muted-foreground/50 hover:shadow-sm",
      )}
      onClick={onClick}
      aria-label={`Slide ${index + 1}`}
      aria-current={isActive ? "true" : undefined}
    >
      <div className="aspect-video overflow-hidden bg-black/80">
        <SlideRenderer slide={slide} renderMode="thumbnail" className="h-full w-full scale-100 text-[5px] [&_h1]:!text-[8px] [&_p]:!text-[5px]" />
      </div>
      {!hideIndex && (
        <div className="absolute bottom-0.5 left-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
          {index + 1}
        </div>
      )}
      {typeLabel && (
        <div className="absolute top-0.5 right-0.5 rounded bg-primary/80 px-1 py-0.5 text-[8px] font-medium text-primary-foreground">
          {typeLabel}
        </div>
      )}
    </button>
  );
}
