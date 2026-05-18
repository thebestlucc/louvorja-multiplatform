import { useRef, useEffect } from "react";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";

export interface SlideFilmstripProps {
  slides: SlideContent[];
  activeIndex: number;
  onSlideClick: (index: number) => void;
  className?: string;
}

function getSlidePreview(slide: SlideContent): { main: string; label: string } {
  switch (slide.slideType) {
    case "lyrics":
      return {
        main: slide.text ?? "",
        label: slide.label ?? "",
      };
    case "cover":
      return {
        main: slide.title,
        label: slide.label ?? "",
      };
    case "bible":
      return {
        main: slide.text ?? "",
        label: slide.reference,
      };
    case "text":
      return {
        main: slide.content.split("\n")[0] ?? "",
        label: "text",
      };
    case "video":
      return {
        main: slide.overlay_text ?? "",
        label: "video",
      };
    case "onlineVideo":
      return {
        main: slide.title ?? "",
        label: "video",
      };
    case "image":
      return {
        main: slide.caption ?? "",
        label: "image",
      };
    case "pause":
      return { main: "", label: "pause" };
  }
}

export function SlideFilmstrip({
  slides,
  activeIndex,
  onSlideClick,
  className,
}: SlideFilmstripProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  if (slides.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col w-[124px] overflow-y-auto border-r border-border bg-muted/30 gap-2 p-2",
        className
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pb-2 border-b border-border mb-1">
        SLIDES
      </div>
      {slides.map((slide, i) => {
        const { main, label } = getSlidePreview(slide);
        const isActive = i === activeIndex;

        return (
          <button
            key={i}
            ref={isActive ? activeRef : undefined}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => onSlideClick(i)}
            className={cn(
              "w-full flex flex-col gap-1 rounded-md p-1 transition-colors cursor-pointer select-none text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive ? "" : "opacity-60 hover:opacity-90"
            )}
          >
            <div
              className={cn(
                "aspect-video bg-zinc-900 rounded overflow-hidden relative border-[1.5px]",
                isActive ? "border-primary" : "border-transparent"
              )}
            >
              {main && (
                <span className="absolute inset-0 flex items-center justify-center p-1 text-[8.5px] leading-tight text-white/80 font-normal overflow-hidden text-center line-clamp-2">
                  {main}
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-[9px] uppercase tracking-wide font-mono truncate pl-0.5",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {label || `${i + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
