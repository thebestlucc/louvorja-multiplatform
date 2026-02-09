import { useEffect, useRef } from "react";
import type { SlideContent } from "../../types/presentation";
import { SlideThumbnail } from "./slide-thumbnail";
import { ScrollArea } from "../ui/scroll-area";

interface SlideListProps {
  slides: SlideContent[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function SlideList({ slides, activeIndex, onSelect }: SlideListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowUp" && activeIndex > 0) {
        e.preventDefault();
        onSelect(activeIndex - 1);
      }
      if (e.key === "ArrowDown" && activeIndex < slides.length - 1) {
        e.preventDefault();
        onSelect(activeIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, slides.length, onSelect]);

  if (slides.length === 0) return null;

  return (
    <ScrollArea className="h-full">
      <div ref={containerRef} className="flex flex-col gap-2 p-2">
        {slides.map((slide, i) => (
          <SlideThumbnail
            key={i}
            slide={slide}
            index={i}
            isActive={i === activeIndex}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
