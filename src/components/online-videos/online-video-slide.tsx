import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen, emitTo } from "@tauri-apps/api/event";
import { useMediaSource } from "../../hooks/use-media-source";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";

// ─── YouTube IFrame API types ──────────────────────────────────────────────

type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerState;
  destroy(): void;
}

declare global {
  interface Window {
    YT: { Player: new (el: HTMLElement | string, cfg: YTPlayerConfig) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerConfig {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: YTPlayerState; target: YTPlayer }) => void;
  };
}

// ─── YouTube API singleton loader ─────────────────────────────────────────

let ytApiLoaded = false;
let ytApiReady = false;
const ytReadyCbs: Array<() => void> = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady) { resolve(); return; }
    ytReadyCbs.push(resolve);
    if (!ytApiLoaded) {
      ytApiLoaded = true;
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytReadyCbs.splice(0).forEach((cb) => cb());
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

// ─── Shared event types ───────────────────────────────────────────────────

type VideoControlEvent = { action: "play" | "pause" | "seek" | "volume"; value?: number };
export type VideoStateEvent = { paused: boolean; currentTime: number; duration: number; volume: number };

export type OnlineVideoRenderMode =
  | "projector"
  | "return-current"
  | "return-next"
  | "playing-now-preview"
  | "editor"
  | "thumbnail";

// ─── LocalVideoPlayer ─────────────────────────────────────────────────────

function LocalVideoPlayer({ src, title, className, muted }: { src: string; title: string; className?: string; muted?: boolean }) {
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
      muted={muted}
    />
  );
}

// ─── YouTubePlayer ────────────────────────────────────────────────────────

function YouTubePlayer({ videoId, title, className, muted = false }: {
  videoId: string;
  title: string;
  className?: string;
  muted?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const emitState = useCallback((player: YTPlayer) => {
    void emitTo("main", "video-state", {
      paused: player.getPlayerState() !== 1, // 1 = PLAYING
      currentTime: player.getCurrentTime(),
      duration: player.getDuration(),
      volume: player.getVolume() / 100,
    } satisfies VideoStateEvent).catch(() => {});
  }, []);

  useEffect(() => {
    let destroyed = false;
    // Each mount gets a stable unique id for YT.Player
    const uid = `yt-${videoId}-${Math.random().toString(36).slice(2)}`;

    void loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;
      containerRef.current.id = uid;

      const player = new window.YT.Player(uid, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          disablekb: 1,
          iv_load_policy: 3,
          mute: muted ? 1 : 0,
          playsinline: 1,
        },
        events: {
          onReady: ({ target }) => {
            playerRef.current = target;
            emitState(target);
          },
          onStateChange: ({ data, target }) => {
            emitState(target);
            clearInterval(pollRef.current);
            if (data === 1) { // PLAYING
              pollRef.current = setInterval(() => emitState(target), 250);
            }
          },
        },
      });
      playerRef.current = player;
    });

    // Listen for video-control events
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const p = playerRef.current;
      if (!p) return;
      const { action, value } = e.payload;
      if (action === "play") p.playVideo();
      else if (action === "pause") p.pauseVideo();
      else if (action === "seek" && value !== undefined) p.seekTo(value, true);
      else if (action === "volume" && value !== undefined) p.setVolume(Math.round(value * 100));
    }).catch(() => () => {});

    return () => {
      destroyed = true;
      clearInterval(pollRef.current);
      try { playerRef.current?.destroy(); } catch (_) {}
      playerRef.current = undefined;
      void unsub.then((fn) => fn());
    };
  }, [videoId, muted, emitState]);

  return (
    <div
      ref={containerRef}
      title={title}
      className={cn("h-full w-full [&>iframe]:pointer-events-none [&>iframe]:border-none", className)}
    />
  );
}

// ─── OnlineVideoSlide ─────────────────────────────────────────────────────

interface OnlineVideoSlideProps {
  slide: SlideContent;
  renderMode: OnlineVideoRenderMode;
  className?: string;
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
        {isLocalFile && localVideoSrc ? (
          <LocalVideoPlayer
            src={localVideoSrc}
            title={slide.videoTitle ?? ""}
            className="h-full w-full"
          />
        ) : slide.videoId ? (
          <YouTubePlayer
            videoId={slide.videoId}
            title={slide.videoTitle ?? slide.videoId}
            className="h-full w-full"
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
    const isLocalVideo = slide.videoSource === "local" && !!localVideoSrc;
    const thumbUrl = slide.videoId
      ? `https://i.ytimg.com/vi/${slide.videoId}/hqdefault.jpg`
      : null;

    return (
      <div className={cn("relative h-full w-full bg-black overflow-hidden", className)}>
        {isLocalVideo ? (
          <LocalVideoPlayer
            src={localVideoSrc!}
            title={slide.videoTitle ?? ""}
            className="h-full w-full object-contain"
            muted
          />
        ) : thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-full w-full object-cover opacity-60" />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col gap-1">
          <span className="rounded bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] text-white/70 self-start">
            {t("presentations.types.onlineVideo")}
          </span>
          <p className="text-xs text-white/80 truncate">{slide.videoTitle ?? slide.videoId ?? ""}</p>
        </div>
      </div>
    );
  }

  if (renderMode === "return-next") {
    const thumbUrl = slide.videoId
      ? `https://i.ytimg.com/vi/${slide.videoId}/hqdefault.jpg`
      : null;

    return (
      <div className={cn("relative h-full w-full bg-black overflow-hidden", className)}>
        {thumbUrl && (
          <img src={thumbUrl} alt="" className="h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex flex-col gap-1">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.25em] text-white/60 self-start">
            {t("presentations.types.onlineVideo")}
          </span>
          <p className="text-[10px] text-white/70 truncate">{slide.videoTitle ?? slide.videoId ?? ""}</p>
        </div>
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

  if (renderMode === "playing-now-preview") {
    const isLocal = slide.videoSource === "local" && !!localVideoSrc;

    return (
      <div className={cn("h-full w-full bg-black relative overflow-hidden", className)}>
        {isLocal ? (
          <LocalVideoPlayer
            src={localVideoSrc!}
            title={slide.videoTitle ?? ""}
            className="h-full w-full object-contain"
            muted
          />
        ) : slide.videoId ? (
          <YouTubePlayer
            videoId={slide.videoId}
            title={slide.videoTitle ?? slide.videoId}
            className="h-full w-full"
            muted
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
            {t("presentations.types.onlineVideo")}
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2 pointer-events-none">
          <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/80 truncate max-w-full">
            {slide.videoTitle ?? ""}
          </span>
        </div>
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
