// src/components/online-videos/persistent-video-player.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import type { PreviewRect } from "../../stores/video-player-store";
import type { SlideContent } from "../../lib/bindings";
import type { VideoControlEvent, VideoStateEvent } from "./online-video-slide";
import { convertFileSrc } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";

// ─── VideoPreviewSlot ─────────────────────────────────────────────────────────

/**
 * Rendered inside Playing Now's preview area.
 * Measures its own bounding rect and publishes it to the store so that
 * PersistentVideoPlayer can overlay the player using CSS position: fixed.
 * No DOM transplanting — the iframe never changes parent.
 */
export function VideoPreviewSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const setPreviewRect = useVideoPlayerStore((s) => s.setPreviewRect);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const publish = () => {
      const r = el.getBoundingClientRect();
      setPreviewRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Publish initial rect
    publish();

    // Track size/position changes
    const ro = new ResizeObserver(publish);
    ro.observe(el);

    // Also re-publish on scroll (in case the preview area scrolls)
    const scrollArea = document.getElementById("main-scroll-area");
    if (scrollArea) scrollArea.addEventListener("scroll", publish, { passive: true });

    return () => {
      ro.disconnect();
      if (scrollArea) scrollArea.removeEventListener("scroll", publish);
      setPreviewRect(null);
    };
  }, [setPreviewRect]);

  return <div ref={ref} className={cn("h-full w-full", className)} />;
}

// ─── PersistentVideoPlayer ────────────────────────────────────────────────────

/**
 * Always-mounted master player. Place in __root.tsx outside <Outlet>.
 *
 * The player host div uses position: fixed to overlay the Playing Now preview
 * when VideoPreviewSlot is mounted (previewRect !== null). When the user
 * navigates away, previewRect becomes null and the host falls back to a
 * "resting" position: visible to the browser (so YouTube keeps playing)
 * but behind all app UI (z-index: -1).
 *
 * The iframe/video element NEVER changes DOM parent — eliminating the browser
 * throttling / YouTube pause that the old DOM-transplant approach caused.
 */
export function PersistentVideoPlayer() {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeSlide, setActiveSlide] = useState<SlideContent | null>(null);

  const previewRect = useVideoPlayerStore((s) => s.previewRect);

  // Resolve local video URL via the asset protocol (synchronous, no streaming server needed).
  const localVideoSrc = (() => {
    if (activeSlide?.videoSource !== "local" || !activeSlide.videoUrl) return null;
    const path = activeSlide.videoUrl.trim();
    if (!path) return null;
    if (/^(https?:|blob:|data:)/.test(path)) return path;
    return convertFileSrc(path);
  })();

  // Helper: broadcast current player state to all windows + update Zustand store
  const broadcastState = useCallback((snap: VideoStateEvent, meta: { videoId: string | null; videoSrc: string | null; videoSource: "youtube" | "local" | null }) => {
    useVideoPlayerStore.getState().setVideoState({ ...snap, ...meta });
    void emit("video-state", snap).catch(() => {});
  }, []);

  // Listen to slide-changed
  useEffect(() => {
    const unsub = listen<SlideContent>("slide-changed", (e) => {
      const slide = e.payload;
      if (slide.slideType === "online_video") {
        setActiveSlide(slide);
      } else {
        // Non-video slide projected: pause but keep player alive
        ytPlayerRef.current?.pauseVideo();
        if (videoRef.current) videoRef.current.pause();
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen to slide-cleared: fully reset ONLY if we were actually playing a video.
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      if (!ytPlayerRef.current && !videoRef.current) return;

      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;

      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
        ytPlayerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.remove();
        videoRef.current = null;
      }
      useVideoPlayerStore.getState().resetVideoState();
      setActiveSlide(null);
      void emit("video-state", {
        paused: true,
        currentTime: 0,
        duration: 0,
        volume: 1,
      } satisfies VideoStateEvent).catch(() => {});
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen to video-control: apply to master player
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const { action, value } = e.payload;

      if (ytPlayerRef.current) {
        const p = ytPlayerRef.current;
        if (action === "play") p.playVideo();
        else if (action === "pause") p.pauseVideo();
        else if (action === "seek" && value !== undefined) p.seekTo(value, true);
        else if (action === "volume" && value !== undefined) p.setVolume(Math.round(value * 100));
      }

      if (videoRef.current) {
        const v = videoRef.current;
        if (action === "play") void v.play().catch(() => {});
        else if (action === "pause") v.pause();
        else if (action === "seek" && value !== undefined) v.currentTime = value;
        else if (action === "volume" && value !== undefined) v.volume = value;
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // ── YouTube player lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    const videoId = activeSlide?.videoSource !== "local" ? (activeSlide?.videoId ?? null) : null;
    if (!videoId || !playerHostRef.current) return;

    let destroyed = false;

    // Clean up any previous YouTube player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
    }

    // Create container div imperatively (React must not manage this node)
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;overflow:hidden;";
    playerHostRef.current.appendChild(container);
    const uid = `yt-master-${Math.random().toString(36).slice(2)}`;
    container.id = uid;

    void loadYouTubeAPI().then(() => {
      if (destroyed || !container.isConnected) return;

      const player = new window.YT.Player(uid, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1, controls: 0, rel: 0,
          modestbranding: 1, showinfo: 0,
          disablekb: 1, iv_load_policy: 3, cc_load_policy: 0,
          mute: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (destroyed) return;
            ytPlayerRef.current = target;
            const iframe = target.getIframe();
            iframe.style.cssText =
              "width:100%;height:100%;pointer-events:none;border:none;" +
              "transform:scale(1.06);transform-origin:center;display:block;";

            pollTimerRef.current = setInterval(() => {
              const snap: VideoStateEvent = {
                paused: target.getPlayerState() !== 1,
                currentTime: target.getCurrentTime(),
                duration: target.getDuration(),
                volume: target.getVolume() / 100,
              };
              broadcastState(snap, { videoId, videoSrc: null, videoSource: "youtube" });
            }, 250);
          },
          onStateChange: ({ data, target }) => {
            if (destroyed) return;
            if (data !== 1) {
              broadcastState(
                {
                  paused: true,
                  currentTime: target.getCurrentTime(),
                  duration: target.getDuration(),
                  volume: target.getVolume() / 100,
                },
                { videoId, videoSrc: null, videoSource: "youtube" },
              );
            }
          },
        },
      });
      ytPlayerRef.current = player;
    });

    return () => {
      destroyed = true;
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
      container.remove();
    };
  }, [activeSlide?.videoId, activeSlide?.videoSource, broadcastState]);

  // ── Local video player lifecycle ──────────────────────────────────────────

  // Effect A: create/destroy the <video> element when slide identity or resolved src changes.
  useEffect(() => {
    const isLocal = activeSlide?.videoSource === "local";
    const videoUrl = activeSlide?.videoUrl ?? null;
    if (!isLocal || !videoUrl || !playerHostRef.current || !localVideoSrc) return;

    // Clean up previous local player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.remove();
      videoRef.current = null;
    }

    const video = document.createElement("video");
    video.style.cssText = "width:100%;height:100%;object-fit:contain;";
    video.playsInline = true;
    video.src = localVideoSrc;
    playerHostRef.current.appendChild(video);
    videoRef.current = video;

    const startPoll = () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = setInterval(() => {
        const snap: VideoStateEvent = {
          paused: video.paused,
          currentTime: video.currentTime,
          duration: isFinite(video.duration) ? video.duration : 0,
          volume: video.volume,
        };
        broadcastState(snap, { videoId: null, videoSrc: localVideoSrc, videoSource: "local" });
      }, 250);
    };

    const onCanPlay = () => {
      video.muted = true;
      void video.play()
        .then(() => { video.muted = false; })
        .catch((err) => {
          console.warn("[PVP] autoplay failed:", err);
          video.muted = false;
        });
      startPoll();
    };

    const onError = () => {
      const e = video.error;
      console.error("[PVP] video error:", e?.code, e?.message, "src:", video.src.slice(0, 120));
    };

    const onPause = () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      broadcastState(
        { paused: true, currentTime: video.currentTime, duration: isFinite(video.duration) ? video.duration : 0, volume: video.volume },
        { videoId: null, videoSrc: localVideoSrc, videoSource: "local" },
      );
    };

    video.addEventListener("error", onError);
    if (video.readyState >= 3) {
      onCanPlay();
    } else {
      video.addEventListener("canplay", onCanPlay, { once: true });
    }
    video.addEventListener("pause", onPause);

    return () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      video.pause();
      video.src = "";
      video.remove();
      videoRef.current = null;
    };
  }, [activeSlide?.videoSource, activeSlide?.videoUrl, localVideoSrc, broadcastState]);

  // ── Compute player host style ──────────────────────────────────────────────

  const hostStyle = computeHostStyle(previewRect);

  return (
    <div
      ref={playerHostRef}
      aria-hidden
      style={hostStyle}
    />
  );
}

// ── Style helper ──────────────────────────────────────────────────────────────

const RESTING_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: 640,
  height: 360,
  pointerEvents: "none",
  zIndex: -1,
  overflow: "hidden",
};

function computeHostStyle(rect: PreviewRect | null): React.CSSProperties {
  if (!rect) return RESTING_STYLE;
  return {
    position: "fixed",
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    pointerEvents: "none",
    zIndex: 10,
    overflow: "hidden",
  };
}
