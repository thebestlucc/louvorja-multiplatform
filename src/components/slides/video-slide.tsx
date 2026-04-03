import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen, emitTo } from "@tauri-apps/api/event";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { VideoPlayer } from "./video-player";
import { useVideoSource } from "../../hooks/use-video-source";

type VideoCtrl = { action: "play" | "pause" | "seek" | "volume"; value?: number };

export type VideoRenderMode = "projector" | "return-current" | "editor";

type VideoSlideVariant = Extract<SlideContent, { slideType: "video" }>;

interface VideoSlideProps {
  slide: VideoSlideVariant;
  renderMode: VideoRenderMode;
  className?: string;
}

export function VideoSlide({ slide, renderMode, className }: VideoSlideProps) {
  const { t } = useTranslation();
  const srcUrl = useVideoSource(slide.path ?? null);
  const projectorVideoRef = useRef<HTMLVideoElement | null>(null);

  // In projector mode: listen for control events + emit state back to main window
  useEffect(() => {
    if (renderMode !== "projector") return;

    const unsub = listen<VideoCtrl>("video-control", (e) => {
      const video = projectorVideoRef.current;
      if (!video) return;
      const { action, value } = e.payload;
      if (action === "play") void video.play().catch(() => {});
      else if (action === "pause") video.pause();
      else if (action === "seek" && value !== undefined) video.currentTime = value;
      else if (action === "volume" && value !== undefined) video.volume = value;
    }).catch(() => () => {});

    return () => { void unsub.then((fn) => fn()); };
  }, [renderMode]);

  const emitVideoState = () => {
    if (renderMode !== "projector") return;
    const video = projectorVideoRef.current;
    if (!video) return;
    void emitTo("main", "video-state", {
      paused: video.paused,
      currentTime: video.currentTime,
      duration: isFinite(video.duration) ? video.duration : 0,
      volume: video.volume,
    }).catch(() => {});
  };

  const shouldAutoplay = useMemo(() => {
    if (renderMode === "editor") {
      return false;
    }
    return slide.auto_play ?? true;
  }, [renderMode, slide.auto_play]);

  const muted = renderMode === "return-current" ? true : (slide.muted ?? false);

  if (!srcUrl) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-black text-white/60", className)}>
        <span className="px-4 text-center text-sm">
          {slide.path ? t("presentations.videoPreparing") : t("presentations.videoNoSource")}
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
        loop={slide.loop_video ?? false}
        muted={muted}
        controls={renderMode === "editor"}
        fit={fit}
        className="h-full w-full"
        videoRef={renderMode === "projector" ? projectorVideoRef : undefined}
        onPlay={renderMode === "projector" ? emitVideoState : undefined}
        onPause={renderMode === "projector" ? emitVideoState : undefined}
        onVolumeChange={renderMode === "projector" ? emitVideoState : undefined}
        onTimeUpdate={renderMode === "projector" ? () => emitVideoState() : undefined}
      />

      {slide.mode === "background" && slide.overlay_text && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 text-center">
          <p
            className="whitespace-pre-line font-semibold"
            style={{
              color: "#ffffff",
              fontSize: `42px`,
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}
          >
            {slide.overlay_text}
          </p>
        </div>
      )}
    </div>
  );
}
