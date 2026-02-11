import type { SlideContent } from "../../types/presentation";
import { cn } from "../../lib/utils";

interface SlideRendererProps {
  slide: SlideContent | null;
  className?: string;
}

export function SlideRenderer({ slide, className }: SlideRendererProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-black text-white",
        className,
      )}
    >
      {!slide || slide.type === "pause" ? (
        <div />
      ) : slide.type === "cover" ? (
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          <h1 className="text-4xl font-bold">{slide.title}</h1>
          {slide.subtitle && (
            <p className="text-xl text-white/70">{slide.subtitle}</p>
          )}
        </div>
      ) : slide.type === "lyrics" ? (
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          {slide.label && (
            <p className="text-sm uppercase tracking-widest text-white/50">
              {slide.label}
            </p>
          )}
          <p className="whitespace-pre-line text-3xl font-semibold leading-relaxed">
            {slide.text}
          </p>
        </div>
      ) : slide.type === "text" ? (
        <div className="px-8 text-center">
          <p className="whitespace-pre-line text-2xl">{slide.text}</p>
        </div>
      ) : slide.type === "bible" ? (
        <div className="flex flex-col items-center gap-6 px-12 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-white/50 font-serif">
            {`${slide.book} ${slide.chapter}:${slide.verseStart}${slide.verseEnd !== slide.verseStart ? `-${slide.verseEnd}` : ""}`}
          </p>
          <div className="flex flex-col gap-3">
            {slide.text.split("\n").map((line, i) => (
              <p key={i} className="text-2xl font-serif leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
