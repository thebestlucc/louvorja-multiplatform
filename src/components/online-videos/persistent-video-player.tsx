// src/components/online-videos/persistent-video-player.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import { useMediaSource } from "../../hooks/use-media-source";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import {
  registerHiddenHost,
  registerPlayerNode,
  clearPlayerNode,
  attachPlayerTo,
  detachPlayerToHost,
  getPlayerNode,
} from "../../lib/video-player-registry";
import type { SlideContent } from "../../lib/bindings";
import type { VideoControlEvent, VideoStateEvent } from "./online-video-slide";
import { cn } from "../../lib/utils";

// ─── VideoPreviewSlot ─────────────────────────────────────────────────────────

/**
 * Rendered inside Playing Now's preview area.
 * Moves the master player's DOM node INTO this slot on mount,
 * and BACK to the hidden host on unmount.
 * The player keeps playing through route changes — no restart.
 */
export function VideoPreviewSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-run when the player node becomes available after a video change
    const tryAttach = () => {
      if (ref.current && getPlayerNode()) {
        attachPlayerTo(ref.current);
      }
    };

    tryAttach();
    // Poll briefly to handle the gap between VideoPreviewSlot mounting and
    // the player finishing initialization (< 1s for YouTube onReady)
    const timer = setInterval(() => {
      if (getPlayerNode()) {
        tryAttach();
        clearInterval(timer);
      }
    }, 100);

    return () => {
      clearInterval(timer);
      detachPlayerToHost();
    };
  }, []);

  return <div ref={ref} className={cn("h-full w-full", className)} />;
}

// ─── PersistentVideoPlayer ────────────────────────────────────────────────────

/**
 * Always-mounted master player. Place in __root.tsx outside <Outlet>.
 * Hidden via a 1×1px absolute div. Owns the real player element that
 * VideoPreviewSlot transplants into the Playing Now preview area.
 */
export function PersistentVideoPlayer() {
  const hiddenHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeSlide, setActiveSlide] = useState<SlideContent | null>(null);

  // Resolve local video URL via streaming server (same hook used elsewhere)
  const localVideoSrc = useMediaSource(
    activeSlide?.videoSource === "local" ? (activeSlide.videoUrl ?? null) : null
  );

  // Register the hidden host div once
  useEffect(() => {
    if (hiddenHostRef.current) {
      registerHiddenHost(hiddenHostRef.current);
    }
  }, []);

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
  // Ignoring slide-cleared when no video is active prevents unrelated clear events
  // (e.g. clearing a hymn slide, pressing Escape) from tearing down the player.
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      // If no video is active, there is nothing to tear down. Ignore the event.
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
      clearPlayerNode();
      useVideoPlayerStore.getState().resetVideoState();
      setActiveSlide(null);
      // Broadcast zero-state so followers reset lastStateRef to zeros (Bug 1 fix)
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
    if (!videoId || !hiddenHostRef.current) return;

    let destroyed = false;

    // Clean up any previous YouTube player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
    }
    clearPlayerNode();

    // Create container div imperatively (React must not manage this node)
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;overflow:hidden;";
    hiddenHostRef.current.appendChild(container);
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
          mute: 0, // master is unmuted — it is the audio source
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (destroyed) return;
            ytPlayerRef.current = target;
            // Apply CSS to hide YT controls and disable interaction on the master iframe (Bug 2 fix)
            const iframe = target.getIframe();
            iframe.style.cssText =
              "width:100%;height:100%;pointer-events:none;border:none;" +
              "transform:scale(1.06);transform-origin:center;display:block;";
            registerPlayerNode(iframe);

            // Start polling every 250ms
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
            // Emit immediately on pause/stop so followers react without waiting for the poll
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
      clearPlayerNode();
      container.remove();
    };
  }, [activeSlide?.videoId, activeSlide?.videoSource, broadcastState]);

  // ── Local video player lifecycle ──────────────────────────────────────────

  // Keep a ref to the latest resolved URL so Effect B can read it imperatively
  // without adding it as a dependency to Effect A (which owns the video element).
  const localVideoSrcRef = useRef<string | null>(null);
  localVideoSrcRef.current = localVideoSrc;

  // Effect A: create/destroy the <video> element only when slide identity changes.
  // Never re-runs due to transient localVideoSrc null values during re-renders.
  useEffect(() => {
    const isLocal = activeSlide?.videoSource === "local";
    const videoSrc = activeSlide?.videoUrl ?? null;
    if (!isLocal || !videoSrc || !hiddenHostRef.current) return;

    // Clean up previous local player
    clearInterval(pollTimerRef.current ?? undefined);
    pollTimerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.remove();
      videoRef.current = null;
    }
    clearPlayerNode();

    // Create <video> imperatively (src will be set by Effect B once resolved)
    const video = document.createElement("video");
    video.style.cssText = "width:100%;height:100%;object-fit:contain;";
    video.playsInline = true;
    hiddenHostRef.current.appendChild(video);
    videoRef.current = video;

    // If the URL is already resolved (Effect B already ran), apply it immediately
    if (localVideoSrcRef.current) {
      video.src = localVideoSrcRef.current;
    }

    const startPoll = (resolvedSrc: string) => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = setInterval(() => {
        const snap: VideoStateEvent = {
          paused: video.paused,
          currentTime: video.currentTime,
          duration: isFinite(video.duration) ? video.duration : 0,
          volume: video.volume,
        };
        broadcastState(snap, { videoId: null, videoSrc: resolvedSrc, videoSource: "local" });
      }, 250);
    };

    const onCanPlay = () => {
      registerPlayerNode(video);
      video.muted = true; // allow autoplay without user gesture (WKWebView/WebView2 policy)
      void video.play()
        .then(() => { video.muted = false; }) // restore audio once playing
        .catch(() => {
          video.muted = false; // restore even on failure so controls work
        });
      startPoll(localVideoSrcRef.current ?? videoSrc);
    };

    const onPause = () => {
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      broadcastState(
        { paused: true, currentTime: video.currentTime, duration: isFinite(video.duration) ? video.duration : 0, volume: video.volume },
        { videoId: null, videoSrc: localVideoSrcRef.current ?? videoSrc, videoSource: "local" },
      );
    };

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
      video.pause();
      video.src = "";
      video.remove();
      videoRef.current = null;
      clearPlayerNode();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlide?.videoSource, activeSlide?.videoUrl, broadcastState]);

  // Effect B: imperatively update video.src when the resolved URL arrives or changes.
  // Does NOT create or destroy the video element — safe to run on every localVideoSrc change.
  useEffect(() => {
    if (!localVideoSrc || !videoRef.current) return;
    if (videoRef.current.src === localVideoSrc) return;
    videoRef.current.src = localVideoSrc;
  }, [localVideoSrc]);

  return (
    <div
      ref={hiddenHostRef}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "640px",
        height: "360px",
        pointerEvents: "none",
        opacity: 0,
        zIndex: -9999,
      }}
    />
  );
}
