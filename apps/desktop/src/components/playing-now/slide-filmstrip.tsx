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
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  if (slides.length === 0) return null;

  return (
    <div
      className={cn(
        "h-[88px] shrink-0 overflow-x-auto flex gap-2 px-1 py-1",
        className
      )}
    >
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
              "w-[132px] h-[74px] flex-shrink-0 rounded cursor-pointer relative overflow-hidden bg-zinc-900 text-left select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive
                ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                : "opacity-60 hover:opacity-90 transition-opacity"
            )}
          >
            {/* Main text — full verse, overflow clipped by parent overflow-hidden */}
            {main && (
              <span className="absolute inset-x-1.5 top-1.5 bottom-5 overflow-hidden text-[9px] leading-tight text-white/90 whitespace-pre-wrap break-words">
                {main}
              </span>
            )}

            {/* Verse label + slide number */}
            <div className="absolute inset-x-1.5 bottom-1 flex items-end justify-between">
              {label ? (
                <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">{label}</span>
              ) : (
                <span />
              )}
              <span className="text-[9px] text-zinc-500 shrink-0">{i + 1}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
