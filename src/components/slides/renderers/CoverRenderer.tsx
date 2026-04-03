import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { cn } from "../../../lib/utils";
import { BackgroundLayer, backgroundContainerStyle, resolveBackground } from "./BackgroundLayer";
import { textStyle, secondaryTextStyle } from "./font-scale";

type CoverSlide = Extract<SlideContent, { slideType: "cover" }>;

interface CoverRendererProps {
  slide: CoverSlide;
  mode: SlideRenderMode;
  globalFontSize?: number;
}

export function CoverRenderer({ slide, mode }: CoverRendererProps) {
  const titleSt = textStyle(slide.text_color, slide.text_size, 48, mode, "cover-title");
  const subtitleSt = secondaryTextStyle(slide.text_color, slide.text_size, 28, mode);
  const bg = resolveBackground(slide.background);
  const hasImage = bg.kind === "image" && !!bg.imagePath;
  const showPanel = hasImage && (mode === "projector" || mode === "return-current");

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
      style={backgroundContainerStyle(slide.background)}
    >
      <BackgroundLayer background={slide.background} />
      <div
        className={cn(
          "relative flex flex-col items-center gap-3",
          showPanel && [
            "max-w-[92%] rounded-md bg-black/62 px-8 py-7 shadow-2xl",
            "md:max-w-[80%] md:px-10 md:py-8",
          ],
        )}
      >
        <h1 className="text-4xl font-bold leading-tight" style={titleSt}>{slide.title}</h1>
        {slide.subtitle && (
          <p className="text-xl text-white/70" style={subtitleSt}>{slide.subtitle}</p>
        )}
      </div>
    </div>
  );
}
