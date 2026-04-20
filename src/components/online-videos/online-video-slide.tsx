import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen, emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MonitorPlay } from "lucide-react";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import { VideoFollowerElement } from "./video-follower-element";
import { useVideoSource } from "../../hooks/use-video-source";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { RustVideoConsumer } from "./rust-video-consumer";

// ─── Shared event types ───────────────────────────────────────────────────

export type VideoControlEvent = { action: "play" | "pause" | "seek" | "volume"; value?: number };
export type VideoStateEvent = {
  paused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  seeking?: boolean;
  seeked?: boolean;
  /** performance.now() at emit time, for one-way latency compensation on followers. */
  emitTs?: number;
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
      const { paused, seeking, currentTime, emitTs } = e.payload;
      if (seeking) {
        if (p.getPlayerState() === 1) p.pauseVideo();
        return;
      }
      // Latency compensation: target master's real-time position, not snapshot
      const latencySec = emitTs != null ? Math.max(0, (performance.now() - emitTs) / 1000) : 0;
      const target = currentTime + latencySec;
      // Drift correction: YT API's setPlaybackRate only accepts discrete values
      // (0.25/0.5/1/1.25/...), so rate nudging isn't viable. Use tighter seek
      // threshold (0.3s) — trade small seek stutter for much tighter sync.
      if (!paused) {
        try {
          const followerTime = p.getCurrentTime();
          if (Math.abs(followerTime - target) > 0.3) {
            p.seekTo(target, true);
          }
        } catch (_) {}
      }
      const state = p.getPlayerState();
      if (paused && state === 1) p.pauseVideo();
      else if (!paused && state !== 1) p.playVideo();
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, [isFollower]);

  // Direct command listener for immediate follower response (play/pause/seek).
  // Commands arriving before the YT player is ready are queued and replayed on onReady.
  const pendingCmdRef = useRef<VideoControlEvent | null>(null);

  useEffect(() => {
    if (!isFollower) return;
    const unsub = listen<VideoControlEvent>("video-control-cmd", (e) => {
      const p = playerRef.current;
      if (!p || typeof p.getPlayerState !== "function") {
        // Player not ready yet — remember the last command so onReady can apply it
        pendingCmdRef.current = e.payload;
        return;
      }
      pendingCmdRef.current = null;
      const { action, value } = e.payload;
      if (action === "play") p.playVideo();
      else if (action === "pause") p.pauseVideo();
      else if (action === "seek" && value !== undefined) p.seekTo(value, true);
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, [isFollower]);

  const emitState = useCallback((player: YTPlayer) => {
    emitTo("main", "video-state", {
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

    loadYouTubeAPI().then(() => {
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
          cc_load_policy: 0,
          mute: (isFollower || muted) ? 1 : 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            playerRef.current = target;
            if (isFollower) {
              // Seek to last known master position on init + latency compensation.
              // If no state yet (late joiner), autoplay — master is already active.
              const last = lastStateRef.current;
              if (last && last.currentTime > 2) {
                const latencySec = last.emitTs != null ? Math.max(0, (performance.now() - last.emitTs) / 1000) : 0;
                target.seekTo(last.currentTime + latencySec, true);
              }
              if (!last || !last.paused) target.playVideo();

              // Replay any command that arrived before the player was ready
              const pending = pendingCmdRef.current;
              if (pending) {
                pendingCmdRef.current = null;
                if (pending.action === "play") target.playVideo();
                else if (pending.action === "pause") target.pauseVideo();
                else if (pending.action === "seek" && pending.value !== undefined) target.seekTo(pending.value, true);
              }
            } else {
              emitState(target);
            }
          },
          onStateChange: ({ data, target }) => {
            if (!isFollower) {
              emitState(target);
              clearInterval(pollRef.current);
              if (data === 1) { // PLAYING
                pollRef.current = setInterval(() => emitState(target), 250);
              }
            }
          },
        },
      });
      playerRef.current = player;
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
      unsub.then((fn) => fn()).catch(() => {});
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
  const useRustVideoPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);

  // Live video renderer for projector/return screens
  const renderLiveVideo = () => {
    const isLocalFile = slide.source === "local" && !!slide.url;
    if (useRustVideoPipeline) {
      return (
        <div className={cn("h-full w-full bg-black", className)}>
          <RustVideoConsumer
            windowLabel={getCurrentWindow().label}
            muted
            className="h-full w-full"
          />
        </div>
      );
    }
    return (
      <div className={cn("h-full w-full bg-black", className)}>
        {isLocalFile ? (
          <LocalVideoFollower videoPath={slide.url} className="h-full w-full" />
        ) : slide.video_id ? (
          <YouTubePlayer
            videoId={slide.video_id}
            title={slide.title ?? slide.video_id}
            className="h-full w-full"
            muted
            isFollower
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
            {t("presentations.types.onlineVideo")}
          </div>
        )}
      </div>
    );
  };

  if (renderMode === "projector") {
    return renderLiveVideo();
  }

  if (renderMode === "return-current") {
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
