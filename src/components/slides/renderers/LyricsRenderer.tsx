import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { cn } from "../../../lib/utils";
import { BackgroundLayer, backgroundContainerStyle, resolveBackground } from "./BackgroundLayer";
import { textStyle, secondaryTextStyle } from "./font-scale";

type LyricsSlide = Extract<SlideContent, { slideType: "lyrics" }>;

interface LyricsRendererProps {
  slide: LyricsSlide;
  mode: SlideRenderMode;
  globalFontSize?: number;
}

export function LyricsRenderer({ slide, mode, globalFontSize = 48 }: LyricsRendererProps) {
  const textLineSt = textStyle(slide.text_color, slide.text_size, globalFontSize, mode, "lyrics");
  const labelSt = secondaryTextStyle(slide.text_color, slide.text_size, 13, mode);
  const bg = resolveBackground(slide.background);
  const hasImage = bg.kind === "image" && !!bg.imagePath;
  const showPanel = hasImage && (mode === "projector" || mode === "return-current");

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
      style={backgroundContainerStyle(slide.background)}
    >
      <BackgroundLayer background={slide.background} />
      {slide.label && (
        <p
          key={slide.label}
          className="relative text-sm uppercase tracking-widest text-white/50 animate-in fade-in duration-200"
          style={labelSt}
        >
          {slide.label}
        </p>
      )}
      <p
        key={slide.text ?? ""}
        className={cn(
          "relative whitespace-pre-line font-semibold leading-snug animate-in fade-in duration-300",
          showPanel && [
            "max-w-[90%] rounded-md bg-black/68 px-8 py-6 shadow-2xl",
            "md:max-w-[82%] md:px-10 md:py-7",
          ],
        )}
        style={textLineSt}
      >
        {slide.text}
      </p>
    </div>
  );
}
