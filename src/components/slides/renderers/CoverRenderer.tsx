import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { cn, hexToRgba } from "../../../lib/utils";
import { BackgroundLayer, backgroundContainerStyle, resolveBackground } from "./BackgroundLayer";
import { textStyle, secondaryTextStyle } from "./font-scale";
import { useLyricsDisplay } from "../../../lib/use-presentation-font-size";
import { useImageSrc } from "../../../hooks/use-image-src";

type CoverSlide = Extract<SlideContent, { slideType: "cover" }>;

interface CoverRendererProps {
  slide: CoverSlide;
  mode: SlideRenderMode;
  globalFontSize?: number;
}

export function CoverRenderer({ slide, mode, globalFontSize = 48 }: CoverRendererProps) {
  const lyricsSettings = useLyricsDisplay();

  const effectiveTextColor = slide.text_color || lyricsSettings.textColor;

  const titleSt = textStyle(effectiveTextColor, slide.text_size, globalFontSize, mode, "cover-title");
  const subtitleSt = secondaryTextStyle(effectiveTextColor, slide.text_size, 28, mode);
  const bg = resolveBackground(slide.background);
  const hasImage = bg.kind === "image" && !!bg.imagePath;
  const resolvedImage = useImageSrc(hasImage ? bg.imagePath : null);

  const showPanel = resolvedImage && (mode === "projector" || mode === "return-current") && lyricsSettings.panelOpacity > 0;
  const panelOpacityValue = lyricsSettings.panelOpacity / 100;

  const containerStyle: React.CSSProperties =
    !slide.background || bg.kind === "image"
      ? { backgroundColor: lyricsSettings.backgroundColor }
      : (backgroundContainerStyle(slide.background) ?? { backgroundColor: lyricsSettings.backgroundColor });

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
      style={containerStyle}
    >
      {resolvedImage && lyricsSettings.enableBackgroundImage ? (
        <>
          <img
            src={resolvedImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={
              lyricsSettings.enableBackdropFilter
                ? { filter: `blur(${lyricsSettings.backdropOpacity / 10}px)` }
                : undefined
            }
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: hexToRgba(lyricsSettings.backgroundColor, lyricsSettings.backdropOpacity / 100) }}
          />
        </>
      ) : !hasImage ? (
        <BackgroundLayer background={slide.background} />
      ) : null}
      <div
        className={cn(
          "relative flex flex-col items-center gap-3",
          showPanel && [
            "max-w-[92%] rounded-md px-8 py-7 shadow-2xl",
            "md:max-w-[80%] md:px-10 md:py-8",
          ],
        )}
        style={
          showPanel
            ? { backgroundColor: hexToRgba(lyricsSettings.backgroundColor, panelOpacityValue) }
            : undefined
        }
      >
        <h1 className="font-bold leading-tight animate-in fade-in duration-300" style={titleSt}>{slide.title}</h1>
        {slide.subtitle && (
          <p className="animate-in fade-in duration-200" style={subtitleSt}>{slide.subtitle}</p>
        )}
      </div>
    </div>
  );
}
