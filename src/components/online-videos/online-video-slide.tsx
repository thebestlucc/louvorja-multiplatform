import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen, emitTo } from "@tauri-apps/api/event";
import { useMediaSource } from "../../hooks/use-media-source";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";

type VideoControlEvent = { action: "play" | "pause" | "seek" | "volume"; value?: number };
export type VideoStateEvent = { paused: boolean; currentTime: number; duration: number; volume: number };

export type OnlineVideoRenderMode =
  | "projector"
  | "return-current"
  | "return-next"
  | "editor"
  | "thumbnail";

interface OnlineVideoSlideProps {
  slide: SlideContent;
  renderMode: OnlineVideoRenderMode;
  className?: string;
}

function LocalVideoPlayer({ src, title, className }: { src: string; title: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Autoplay with canplay guard (avoids NotSupportedError in Tauri webview)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tryPlay = () => {
      void video.play().catch(() => {
        // Already failed — leave it paused; Playing Now controls can resume
      });
    };
    if (video.readyState >= 3) {
      tryPlay();
    } else {
      video.addEventListener("canplay", tryPlay, { once: true });
      return () => video.removeEventListener("canplay", tryPlay);
    }
  }, [src]);

  // Listen for video-control events from main window
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const video = videoRef.current;
      if (!video) return;
      const { action, value } = e.payload;
      if (action === "play") void video.play().catch(() => {});
      else if (action === "pause") video.pause();
      else if (action === "seek" && value !== undefined) video.currentTime = value;
      else if (action === "volume" && value !== undefined) video.volume = value;
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Emit video-state to main window on playback events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const emit = () => {
      void emitTo("main", "video-state", {
        paused: video.paused,
        currentTime: video.currentTime,
        duration: isFinite(video.duration) ? video.duration : 0,
        volume: video.volume,
      } satisfies VideoStateEvent).catch(() => {});
    };
    video.addEventListener("timeupdate", emit);
    video.addEventListener("play", emit);
    video.addEventListener("pause", emit);
    video.addEventListener("volumechange", emit);
    return () => {
      video.removeEventListener("timeupdate", emit);
      video.removeEventListener("play", emit);
      video.removeEventListener("pause", emit);
      video.removeEventListener("volumechange", emit);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      title={title}
      playsInline
    />
  );
}

export function OnlineVideoSlide({ slide, renderMode, className }: OnlineVideoSlideProps) {
  const { t } = useTranslation();
  const localVideoSrc = useMediaSource(
    slide.videoSource === "local" ? (slide.videoUrl ?? null) : null
  );

  if (renderMode === "projector") {
    const isLocalFile = slide.videoSource === "local" && !!slide.videoUrl;

    return (
      <div className={cn("h-full w-full bg-black", className)}>
        {isLocalFile && slide.videoUrl ? (
          <LocalVideoPlayer
            src={localVideoSrc ?? ""}
            title={slide.videoTitle ?? ""}
            className="h-full w-full"
          />
        ) : slide.videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${slide.videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&showinfo=0&disablekb=1&iv_load_policy=3`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="h-full w-full"
            style={{ border: "none", pointerEvents: "none" }}
            title={slide.videoTitle ?? slide.videoId}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
            {t("presentations.types.onlineVideo")}
          </div>
        )}
      </div>
    );
  }

  if (renderMode === "return-current") {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white", className)}>
        <span className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80">
          {t("presentations.types.onlineVideo")}
        </span>
        <p className="text-sm text-center text-white/60 px-4 truncate max-w-full">
          {slide.videoTitle ?? slide.videoId ?? ""}
        </p>
      </div>
    );
  }

  if (renderMode === "return-next") {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white", className)}>
        <span className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80">
          {t("presentations.types.onlineVideo")}
        </span>
        <p className="text-xs text-center text-white/60 px-4 truncate max-w-full">
          {slide.videoTitle ?? slide.videoId ?? ""}
        </p>
      </div>
    );
  }

  if (renderMode === "thumbnail") {
    return (
      <div className={cn("flex h-full w-full min-w-0 max-w-full flex-col items-stretch justify-center gap-1 overflow-hidden px-2 text-center", className)}>
        <span className="self-center rounded bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/80">
          {t("presentations.types.onlineVideo")}
        </span>
        <span
          className="block w-full overflow-hidden break-all text-[10px] leading-tight text-white/60"
          title={slide.videoTitle ?? ""}
        >
          {slide.videoTitle ?? slide.videoId ?? ""}
        </span>
      </div>
    );
  }

  // editor mode
  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      {slide.videoId && (
        <img
          src={`https://i.ytimg.com/vi/${slide.videoId}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-contain"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-xs text-white/80 truncate">{slide.videoTitle ?? ""}</p>
      </div>
    </div>
  );
}
