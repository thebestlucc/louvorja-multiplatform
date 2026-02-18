import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation-store";
import { useDisplayStore } from "../../stores/display-store";
import { useSlides } from "../../hooks/use-slides";
import { stopProjectionAndSongAudio } from "../../lib/projection-control";
import { SlideRenderer } from "../slides/slide-renderer";
import { cn } from "../../lib/utils";

export function SlideNavBar() {
  const { slides, activeSlideIndex, setSlides } = usePresentationStore();
  const projectorWindowOpen = useDisplayStore((s) => s.projectorWindowOpen);
  const { goToSlide, nextSlide, prevSlide } = useSlides();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (activeThumbRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeSlideIndex]);

  if (!projectorWindowOpen || slides.length === 0) return null;

  return (
    <div className="flex h-16 items-center gap-2 border-t border-border bg-surface px-2">
      {/* Prev button */}
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-muted disabled:opacity-30"
        onClick={() => prevSlide()}
        disabled={activeSlideIndex <= 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Position indicator */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {activeSlideIndex + 1} / {slides.length}
      </span>

      {/* Thumbnail scroll container */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none"
      >
        {slides.map((slide, i) => (
          <button
            key={i}
            ref={i === activeSlideIndex ? activeThumbRef : undefined}
            className={cn(
              "relative h-10 w-[72px] shrink-0 overflow-hidden rounded border-2 transition-colors",
              i === activeSlideIndex
                ? "border-primary ring-1 ring-primary"
                : "border-transparent hover:border-muted-foreground/50",
            )}
            onClick={() => goToSlide(i)}
          >
            <SlideRenderer
              slide={slide}
              renderMode="thumbnail"
              className="h-full w-full scale-100 text-[3px] [&_h1]:!text-[5px] [&_p]:!text-[3px]"
            />
          </button>
        ))}
      </div>

      {/* Next button */}
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-muted"
        onClick={() => nextSlide()}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Clear button */}
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => {
          setSlides([]);
          void stopProjectionAndSongAudio();
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
