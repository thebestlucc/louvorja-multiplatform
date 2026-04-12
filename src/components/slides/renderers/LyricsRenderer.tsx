import type { SlideContent } from "../../../lib/bindings";
import type { SlideRenderMode } from "../slide-renderer";
import { cn, hexToRgba } from "../../../lib/utils";

type LyricsSlide = Extract<SlideContent, { slideType: "lyrics" }>;
import { BackgroundLayer, backgroundContainerStyle, resolveBackground } from "./BackgroundLayer";
import { textStyle, secondaryTextStyle } from "./font-scale";
import { useLyricsDisplay } from "../../../lib/use-presentation-font-size";
import { useImageSrc } from "../../../hooks/use-image-src";

interface LyricsRendererProps {
  slide: LyricsSlide;
  mode: SlideRenderMode;
  globalFontSize?: number;
}

export function LyricsRenderer({ slide, mode, globalFontSize = 48 }: LyricsRendererProps) {
  const lyricsSettings = useLyricsDisplay();

  // Determine effective text color: slide-specific > global setting > default
  const effectiveTextColor = slide.text_color || lyricsSettings.textColor;

  const textLineSt = textStyle(effectiveTextColor, slide.text_size, globalFontSize, mode, "lyrics");
  const labelSt = secondaryTextStyle(effectiveTextColor, slide.text_size, 13, mode);
  const bg = resolveBackground(slide.background);
  const hasImage = bg.kind === "image" && !!bg.imagePath;
  const resolvedImage = useImageSrc(hasImage ? bg.imagePath : null);

  // Panel only shows when there's a background image AND the user has panelOpacity > 0
  const showPanel = resolvedImage && (mode === "projector" || mode === "return-current") && lyricsSettings.panelOpacity > 0;
  const panelOpacityValue = lyricsSettings.panelOpacity / 100;

  // Use lyrics backgroundColor as the container base in two cases:
  // 1. No per-slide background → avoids the hardcoded #1a1a2e default
  // 2. Image-type background → backgroundContainerStyle returns undefined for images
  //    (the image renders as an absolute <img>), so without an explicit bg the container
  //    falls through to the browser's black default.
  // Per-slide solid/gradient backgrounds override the global setting.
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
        // Album art enabled: show blurred image + dark overlay
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
        // No album art: render slide's non-image background (solid/gradient)
        <BackgroundLayer background={slide.background} />
      ) : null
      /* Image exists but disabled: container backgroundColor is the visible background */}
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
            "max-w-[90%] rounded-md px-8 py-6 shadow-2xl",
            "md:max-w-[82%] md:px-10 md:py-7",
          ],
        )}
        style={{
          ...textLineSt,
          ...(showPanel
            ? { backgroundColor: hexToRgba(lyricsSettings.backgroundColor, panelOpacityValue) }
            : {}),
        }}
      >
        {slide.text}
      </p>
    </div>
  );
}
