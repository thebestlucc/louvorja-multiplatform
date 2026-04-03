import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { useProjectionDisplay } from "../../lib/use-presentation-font-size";
import { CoverRenderer } from "./renderers/CoverRenderer";
import { LyricsRenderer } from "./renderers/LyricsRenderer";
import { TextRenderer } from "./renderers/TextRenderer";
import { ImageRenderer } from "./renderers/ImageRenderer";
import { VideoRenderer } from "./renderers/VideoRenderer";
import { BibleRenderer } from "./renderers/BibleRenderer";
import { OnlineVideoRenderer } from "./renderers/OnlineVideoRenderer";
import { PauseRenderer } from "./renderers/PauseRenderer";
import "./renderers/scale-vars.css";

export type SlideRenderMode = "projector" | "return-current" | "return-next" | "playing-now-preview" | "editor" | "thumbnail";

interface SlideRendererProps {
  slide: SlideContent | null;
  className?: string;
  renderMode?: SlideRenderMode;
}

export function SlideRenderer({ slide, className, renderMode = "projector" }: SlideRendererProps) {
  const { fontSize: globalFontSize, fontFamily: globalFontFamily } = useProjectionDisplay();

  // User text-size override injected as CSS custom properties
  const userSize = slide && "text_size" in slide && slide.text_size
    ? `${slide.text_size}px`
    : undefined;

  return (
    <div
      className={cn(
        "slide-renderer relative flex items-center justify-center overflow-hidden bg-black text-white p-4",
        className,
      )}
      data-mode={renderMode}
      style={{
        "--user-title": userSize,
        "--user-body": userSize,
        ...(globalFontFamily && globalFontFamily !== "__system__" ? { fontFamily: globalFontFamily } : {}),
      } as React.CSSProperties}
    >
      {renderSlideContent(slide, renderMode, globalFontSize)}
    </div>
  );
}

function renderSlideContent(
  slide: SlideContent | null,
  renderMode: SlideRenderMode,
  globalFontSize: number,
): React.ReactNode {
  if (!slide) return <PauseRenderer />;

  switch (slide.slideType) {
    case "cover":
      return <CoverRenderer slide={slide} mode={renderMode} globalFontSize={globalFontSize} />;
    case "lyrics":
      return <LyricsRenderer slide={slide} mode={renderMode} globalFontSize={globalFontSize} />;
    case "text":
      return <TextRenderer slide={slide} mode={renderMode} />;
    case "image":
      return <ImageRenderer slide={slide} />;
    case "video":
      return <VideoRenderer slide={slide} mode={renderMode} />;
    case "bible":
      return <BibleRenderer slide={slide} mode={renderMode} />;
    case "onlineVideo":
      return <OnlineVideoRenderer slide={slide} mode={renderMode} />;
    case "pause":
      return <PauseRenderer />;
    default:
      return null;
  }
}
