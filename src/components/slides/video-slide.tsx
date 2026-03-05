import { useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { resolveMediaPath } from "../../lib/tauri";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { VideoPlayer } from "./video-player";

export type VideoRenderMode = "projector" | "return-current" | "editor";

interface VideoSlideProps {
  slide: SlideContent;
  renderMode: VideoRenderMode;
  className?: string;
}

export function VideoSlide({ slide, renderMode, className }: VideoSlideProps) {
  const { t } = useTranslation();
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSource = async () => {
      setError(null);
      setResolvedSrc(null);

      if (!slide.videoPath) {
        setError(t("presentations.videoNoSource"));
        return;
      }

      try {
        const absolutePath = await resolveMediaPath(slide.videoPath);
        if (!cancelled) {
          setResolvedSrc(convertFileSrc(absolutePath));
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      }
    };

    void loadSource();

    return () => {
      cancelled = true;
    };
  }, [slide.videoPath, t]);

  const shouldAutoplay = useMemo(() => {
    if (renderMode === "editor") {
      return false;
    }
    return slide.autoPlay ?? true;
  }, [renderMode, slide.autoPlay]);

  const muted = renderMode === "return-current" ? true : (slide.muted ?? false);

  if (!resolvedSrc) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-black text-white/60", className)}>
        <span className="px-4 text-center text-sm">
          {error ?? t("presentations.videoPreparing")}
        </span>
      </div>
    );
  }

  const fit = slide.mode === "background" ? "cover" : "contain";

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <VideoPlayer
        src={resolvedSrc}
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
