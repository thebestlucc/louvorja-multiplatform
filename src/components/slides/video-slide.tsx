import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { VideoPlayer } from "./video-player";
import { useMediaSource } from "../../hooks/use-media-source";

export type VideoRenderMode = "projector" | "return-current" | "editor";

interface VideoSlideProps {
  slide: SlideContent;
  renderMode: VideoRenderMode;
  className?: string;
}

export function VideoSlide({ slide, renderMode, className }: VideoSlideProps) {
  const { t } = useTranslation();
  const srcUrl = useMediaSource(slide.videoPath ?? null);

  const shouldAutoplay = useMemo(() => {
    if (renderMode === "editor") {
      return false;
    }
    return slide.autoPlay ?? true;
  }, [renderMode, slide.autoPlay]);

  const muted = renderMode === "return-current" ? true : (slide.muted ?? false);

  if (!srcUrl) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-black text-white/60", className)}>
        <span className="px-4 text-center text-sm">
          {slide.videoPath ? t("presentations.videoPreparing") : t("presentations.videoNoSource")}
        </span>
      </div>
    );
  }

  const fit = slide.mode === "background" ? "cover" : "contain";

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <VideoPlayer
        src={srcUrl}
        autoPlay={shouldAutoplay}
        loop={slide.loop ?? false}
        muted={muted}
        controls={renderMode === "editor"}
        fit={fit}
        className="h-full w-full"
      />

      {slide.mode === "background" && slide.text && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 text-center">
          <p
            className="whitespace-pre-line font-semibold"
            style={{
              color: slide.textColor ?? "#ffffff",
              fontSize: `${slide.textSize ?? 42}px`,
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}
          >
            {slide.text}
          </p>
        </div>
      )}
    </div>
  );
}
