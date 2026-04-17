import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen, emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MonitorPlay } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import { VideoFollowerElement } from "./video-follower-element";
import { useVideoSource } from "../../hooks/use-video-source";
import { useVideoPlayerStore, type LocalTarget } from "../../stores/video-player-store";

// ─── Shared event types ───────────────────────────────────────────────────

export type VideoControlEvent = { action: "play" | "pause" | "seek" | "volume"; value?: number };
export type VideoStateEvent = {
  paused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  seeking?: boolean;
  seeked?: boolean;
};

export type OnlineVideoRenderMode =
  | "projector"
  | "return-current"
  | "return-next"
  | "playing-now-preview"
  | "editor"
  | "thumbnail";

// ─── YouTubePlayer ────────────────────────────────────────────────────────

export function YouTubePlayer({ videoId, title, className, muted = false, isFollower = false }: {
  videoId: string; title: string; className?: string; muted?: boolean; isFollower?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastStateRef = useRef<VideoStateEvent | null>(null);

  // Track master video-state for follower sync + drift correction
  useEffect(() => {
    if (!isFollower) return;
    const unsub = listen<VideoStateEvent>("video-state", (e) => {
      lastStateRef.current = e.payload;
      const p = playerRef.current;
      if (!p || typeof p.getPlayerState !== "function") return;
      const { paused, seeking, currentTime } = e.payload;
      if (seeking) {
        if (p.getPlayerState() === 1) p.pauseVideo();
        return;
      }
      // Drift correction: resync aggressively. WKWebView + two independent
      // YT iframes drift because they autoplay from URL params at different
      // scheduling ticks. Tight threshold keeps audio (master) and image
      // (follower) in lockstep.
      if (!paused) {
        try {
          const followerTime = p.getCurrentTime();
          const drift = Math.abs(followerTime - currentTime);
          if (drift > 0.25) {
            p.seekTo(currentTime, true);
          }
        } catch (_) {}
      }
      const state = p.getPlayerState();
      if (paused && state === 1) p.pauseVideo();
      else if (!paused && state !== 1) p.playVideo();
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, [isFollower]);

  // Direct command listener for immediate follower response (play/pause/seek)
  useEffect(() => {
    if (!isFollower) return;
    const unsub = listen<VideoControlEvent>("video-control-cmd", (e) => {
      const p = playerRef.current;
      if (!p || typeof p.getPlayerState !== "function") return;
      const { action, value } = e.payload;
      if (action === "play") p.playVideo();
      else if (action === "pause") p.pauseVideo();
      else if (action === "seek" && value !== undefined) p.seekTo(value, true);
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, [isFollower]);

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

    console.log("[YouTubePlayer]", isFollower ? "follower" : "master", "creating for", videoId);
    void loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) {
        console.warn("[YouTubePlayer] skipping create — destroyed=", destroyed, "ref=", !!containerRef.current);
        return;
      }
      if (!window.YT || !window.YT.Player) {
        console.error("[YouTubePlayer] window.YT.Player unavailable after loadYouTubeAPI");
        return;
      }
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
          cc_load_policy: 0,
          mute: (isFollower || muted) ? 1 : 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            console.log("[YouTubePlayer]", isFollower ? "follower" : "master", "onReady for", videoId);
            playerRef.current = target;
            if (isFollower) {
              // Seek to last known master position on init.
              // If no state yet (late joiner), autoplay — master is already active.
              const last = lastStateRef.current;
              if (last && last.currentTime > 2) {
                target.seekTo(last.currentTime, true);
              }
              if (!last || !last.paused) target.playVideo();
            } else {
              emitState(target);
            }
          },
          onStateChange: ({ data, target }) => {
            console.log("[YouTubePlayer]", isFollower ? "follower" : "master", "onStateChange", data, "for", videoId);
            if (!isFollower) {
              emitState(target);
              clearInterval(pollRef.current);
              if (data === 1) { // PLAYING
                pollRef.current = setInterval(() => emitState(target), 250);
              }
            }
          },
          onError: ({ data }) => {
            console.error("[YouTubePlayer]", isFollower ? "follower" : "master", "onError", data, "for", videoId);
          },
        },
      });
      playerRef.current = player;
    }).catch((err) => {
      console.error("[YouTubePlayer] loadYouTubeAPI failed:", err);
    });

    // Listen for video-control events
    const unsub = !isFollower
      ? listen<VideoControlEvent>("video-control", (e) => {
          const p = playerRef.current;
          if (!p) return;
          const { action, value } = e.payload;
          if (action === "play") p.playVideo();
          else if (action === "pause") p.pauseVideo();
          else if (action === "seek" && value !== undefined) p.seekTo(value, true);
          else if (action === "volume" && value !== undefined) p.setVolume(Math.round(value * 100));
        }).catch(() => () => {})
      : Promise.resolve(() => {});

    return () => {
      destroyed = true;
      clearInterval(pollRef.current);
      try { playerRef.current?.destroy(); } catch (_) {}
      playerRef.current = undefined;
      void unsub.then((fn) => fn());
    };
  }, [videoId, muted, isFollower, emitState]);

  return (
    <div
      ref={containerRef}
      title={title}
      // overflow-hidden + scale-[1.06] clips the YouTube logo/watermark from all corners
      // while keeping the video centered. Scale is imperceptible on a projection screen.
      className={cn(
        "h-full w-full overflow-hidden",
        "[&>iframe]:pointer-events-none [&>iframe]:border-none",
        "[&>iframe]:scale-[1.06] [&>iframe]:origin-center",
        className,
      )}
    />
  );
}

// ─── LocalVideoFollower ───────────────────────────────────────────────────

function LocalVideoFollower({ videoPath, className }: { videoPath: string; className?: string }) {
  const videoUrl = useVideoSource(videoPath);
  if (!videoUrl) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-black", className)}>
        <MonitorPlay className="h-12 w-12 text-white/15" />
      </div>
    );
  }
  return <VideoFollowerElement videoUrl={videoUrl} className={className} />;
}

// ─── OnlineVideoSlide ─────────────────────────────────────────────────────

type OnlineVideoSlideVariant = Extract<SlideContent, { slideType: "onlineVideo" }>;

interface OnlineVideoSlideProps {
  slide: OnlineVideoSlideVariant;
  renderMode: OnlineVideoRenderMode;
  className?: string;
}

export function OnlineVideoSlide({ slide, renderMode, className }: OnlineVideoSlideProps) {
  const { t } = useTranslation();
  const mode = useVideoPlayerStore((s) => s.mode);
  const localTargets = useVideoPlayerStore((s) => s.videoPlaybackTargets);
  const liveTarget = useVideoPlayerStore((s) => s.liveTarget);

  const windowLabel = typeof window !== "undefined" ? getCurrentWebviewWindow().label : "main";
  const currentTarget: LocalTarget =
    windowLabel === "projector" || windowLabel === "return" ? windowLabel : "main";

  const renderThumbnailOnly = () => {
    const thumbUrl = slide.video_id
      ? `https://i.ytimg.com/vi/${slide.video_id}/hqdefault.jpg`
      : null;
    return (
      <div className={cn("relative h-full w-full bg-black overflow-hidden", className)}>
        {thumbUrl && <img src={thumbUrl} alt="" className="h-full w-full object-contain opacity-60" />}
      </div>
    );
  };

  const renderLiveVideo = () => {
    // Decision: what does THIS window render for this slide?
    // 1. mode=local + this window in videoPlaybackTargets → muted follower.
    // 2. mode=live-youtube + this window === liveTarget → THE YT iframe (not a follower).
    // 3. else → thumbnail.
    if (mode?.kind === "local") {
      if (!localTargets.includes(currentTarget)) return renderThumbnailOnly();
      return (
        <div className={cn("h-full w-full bg-black", className)}>
          <LocalVideoFollower videoPath={mode.path} className="h-full w-full" />
        </div>
      );
    }

    if (mode?.kind === "live-youtube") {
      if (liveTarget !== currentTarget) return renderThumbnailOnly();
      // Sole iframe — NOT a follower. Audio-bearing. Never drift-corrected.
      return (
        <div className={cn("h-full w-full bg-black", className)}>
          <YouTubePlayer
            videoId={mode.videoId}
            title={mode.title ?? mode.videoId}
            className="h-full w-full"
            muted={false}
            isFollower={false}
          />
        </div>
      );
    }

    // mode === null: fall back to slide.source inspection, still respecting targets.
    const isLocalFile = slide.source === "local" && !!slide.url;
    if (isLocalFile && localTargets.includes(currentTarget)) {
      return (
        <div className={cn("h-full w-full bg-black", className)}>
          <LocalVideoFollower videoPath={slide.url} className="h-full w-full" />
        </div>
      );
    }
    return renderThumbnailOnly();
  };

  if (renderMode === "projector" || renderMode === "return-current") {
    return renderLiveVideo();
  }

  if (renderMode === "return-next") {
    const thumbUrl = slide.video_id
      ? `https://i.ytimg.com/vi/${slide.video_id}/hqdefault.jpg`
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
          <p className="text-[10px] text-white/70 truncate">{slide.title ?? slide.video_id ?? ""}</p>
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
          title={slide.title ?? ""}
        >
          {slide.title ?? slide.video_id ?? ""}
        </span>
      </div>
    );
  }

  if (renderMode === "playing-now-preview") {
    const thumbUrl = slide.video_id
      ? `https://i.ytimg.com/vi/${slide.video_id}/hqdefault.jpg`
      : null;
    return (
      <div className={cn("h-full w-full bg-black relative overflow-hidden", className)}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
            {t("presentations.types.onlineVideo")}
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2 pointer-events-none">
          <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/80 truncate max-w-full">
            {slide.title ?? ""}
          </span>
        </div>
      </div>
    );
  }

  // editor mode
  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      {slide.video_id && (
        <img
          src={`https://i.ytimg.com/vi/${slide.video_id}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-contain"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-xs text-white/80 truncate">{slide.title ?? ""}</p>
      </div>
    </div>
  );
}
