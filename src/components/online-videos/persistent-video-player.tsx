// src/components/online-videos/persistent-video-player.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emit, emitTo } from "@tauri-apps/api/event";
import { loadYouTubeAPI } from "../../lib/youtube-api";
import type { YTPlayer } from "../../lib/youtube-api";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { useMediaPlayerStore } from "../../stores/media-player-store";
import { useQueueStore } from "../../stores/queue-store";
import { useVideoSource } from "../../hooks/use-video-source";
import { clearCurrentSlide } from "../../lib/tauri/display";
import type { OnlineVideoMediaItem, OfflineVideoMediaItem } from "../../types/media";
import type { SlideContent } from "../../lib/bindings";
import type { VideoControlEvent, VideoStateEvent } from "./online-video-slide";

/** Heartbeat interval for progress bar updates and drift detection (ms). */
const HEARTBEAT_INTERVAL_MS = 250;

/**
 * Checks if there is a next item in the queue (accounting for repeat mode).
 * Returns true if the queue coordinator will handle advancing; false if we are
 * at the last item with no loop — meaning we should clear the screens.
 */
function hasNextQueueItem(): boolean {
  const q = useQueueStore.getState();
  if (q.repeat === "one" || q.repeat === "all") return true;
  return q.items.length > 0 && q.currentIndex < q.items.length - 1;
}

/** Advances queue or clears projection screens when a video ends. */
function handleVideoEnded() {
  if (hasNextQueueItem()) {
    useQueueStore.getState().next();
  } else {
    void clearCurrentSlide();
    useVideoPlayerStore.getState().resetVideoState();
  }
}

// ─── LocalVideoMaster ─────────────────────────────────────────────────────────

/**
 * Module-level ref giving the preview canvas direct access to the master video
 * element without an extra decode or IPC round-trip.
 */
export const localVideoMasterRef: { current: HTMLVideoElement | null } = { current: null };

/**
 * Hidden HTML5 <video> element that acts as the master player for local files.
 * Emits video-state events on time updates and control events.
 */
function LocalVideoMaster({
  videoPath,
  onBroadcast,
}: {
  videoPath: string;
  onBroadcast: (snap: VideoStateEvent) => void;
}) {
  const videoUrl = useVideoSource(videoPath);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onBroadcastRef = useRef(onBroadcast);
  onBroadcastRef.current = onBroadcast;

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    localVideoMasterRef.current = el;
  }, []);

  // Listen to video-control events and apply to local video element
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const video = videoRef.current;
      if (!video) return;
      const { action, value } = e.payload;
      if (action === "play") {
        void video.play().catch(() => {});
        // Broadcast to all windows
        for (const target of ["main", "projector", "return"] as const) {
          void emitTo(target, "video-control-cmd", { action: "play" }).catch(() => {});
        }
      } else if (action === "pause") {
        video.pause();
        for (const target of ["main", "projector", "return"] as const) {
          void emitTo(target, "video-control-cmd", { action: "pause" }).catch(() => {});
        }
      } else if (action === "seek" && value !== undefined) {
        video.currentTime = value;
        for (const target of ["main", "projector", "return"] as const) {
          void emitTo(target, "video-control-cmd", { action: "seek", value }).catch(() => {});
        }
      } else if (action === "volume" && value !== undefined) {
        video.volume = value;
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  if (!videoUrl) return null;

  return (
    <video
      ref={setVideoRef}
      src={videoUrl}
      autoPlay
      playsInline
      style={{ width: 1, height: 1, opacity: 0, position: "absolute", pointerEvents: "none" }}
      onError={(e) => {
        const v = e.currentTarget;
        const err = v.error;
        console.error(
          "[LocalVideoMaster] video error:",
          err ? `code=${err.code} message="${err.message}"` : "unknown",
          "src:", v.src,
        );
      }}
      onCanPlay={() => console.log("[LocalVideoMaster] canplay — video ready")}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        onBroadcastRef.current({
          paused: v.paused,
          currentTime: v.currentTime,
          duration: v.duration || 0,
          volume: v.volume,
        });
      }}
      onPlay={(e) => {
        const v = e.currentTarget;
        onBroadcastRef.current({
          paused: false,
          currentTime: v.currentTime,
          duration: v.duration || 0,
          volume: v.volume,
        });
      }}
      onPause={(e) => {
        const v = e.currentTarget;
        onBroadcastRef.current({
          paused: true,
          currentTime: v.currentTime,
          duration: v.duration || 0,
          volume: v.volume,
        });
      }}
      onEnded={(e) => {
        const v = e.currentTarget;
        onBroadcastRef.current({
          paused: true,
          currentTime: v.currentTime,
          duration: v.duration || 0,
          volume: v.volume,
        });
        handleVideoEnded();
      }}
    />
  );
}

// ─── PersistentVideoPlayer ────────────────────────────────────────────────────

/**
 * Always-mounted master player. Place in __root.tsx outside <Outlet>.
 *
 * The player host div uses position: fixed behind all app UI (z-index: -1),
 * visible to the browser (so YouTube keeps playing) but not to the user.
 * Playing Now shows a thumbnail instead of this live player.
 *
 * The iframe/video element NEVER changes DOM parent — eliminating the browser
 * throttling / YouTube pause that the old DOM-transplant approach caused.
 */
export function PersistentVideoPlayer() {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekingRef = useRef(false);
  const playSessionIdRef = useRef(0);
  const [activeSlide, setActiveSlide] = useState<SlideContent | null>(null);
  const activeSlideRef = useRef<SlideContent | null>(null);
  const [playSessionId, setPlaySessionId] = useState(0);

  // Helper: broadcast current player state to all windows + update Zustand store.
  // Must use emitTo() for each window — JS emit() only reaches the current webview.
  // Skips broadcasts while master is seeking (prevents state flood + follower seek storm).
  const broadcastState = useCallback((snap: VideoStateEvent, meta: { videoId: string | null; videoSrc: string | null; videoSource: "youtube" | "local" | null }, force = false) => {
    if (seekingRef.current && !force) return;
    useVideoPlayerStore.getState().setVideoState({ ...snap, ...meta });
    const enriched = { ...snap, seeking: seekingRef.current };
    // Global emit so Rust event.rs can bridge video-state to WS clients.
    void emit("video-state", enriched).catch(() => {});
    for (const target of ["main", "projector", "return"]) {
      void emitTo(target, "video-state", enriched).catch(() => {});
    }
  }, []);

  // Callback for LocalVideoMaster to broadcast state
  const broadcastLocalState = useCallback((snap: VideoStateEvent) => {
    broadcastState(snap, { videoId: null, videoSrc: null, videoSource: "local" });
  }, [broadcastState]);

  // Listen to slide-changed
  useEffect(() => {
    const unsub = listen<SlideContent>("slide-changed", (e) => {
      const slide = e.payload;
      if (slide.slideType === "onlineVideo") {
        // Only bump the play session (destroys + rebuilds the YT player) when
        // the video identity actually changes. Re-emits of the same video —
        // e.g. `state.sync` when a remote reconnects — must NOT restart
        // playback.
        const prev = activeSlideRef.current;
        const isSameVideo =
          prev?.slideType === "onlineVideo" &&
          prev.source === slide.source &&
          prev.video_id === slide.video_id &&
          prev.url === slide.url;
        if (!isSameVideo) {
          playSessionIdRef.current += 1;
          setPlaySessionId(playSessionIdRef.current);
        }
        setActiveSlide(slide);
        activeSlideRef.current = slide;

        // Bridge to media-player-store so Playing Now shows video preview
        const mpState = useMediaPlayerStore.getState();
        if (slide.source === "local" && slide.url) {
          const item: OfflineVideoMediaItem = {
            type: "offline_video",
            videoPath: slide.url,
            title: slide.title ?? "Video",
            isManaged: slide.url.startsWith("media/"),
          };
          // Always load to reset timelineSource to "video" (stop() sets it to "none")
          mpState.load(item);
        } else if (slide.video_id) {
          const item: OnlineVideoMediaItem = {
            type: "online_video",
            videoId: slide.video_id,
            videoSource: "youtube",
            title: slide.title ?? "Video",
          };
          mpState.load(item);
        }
      } else if (activeSlideRef.current) {
        // Non-video slide replaced the video: fully stop and clean up
        clearInterval(pollTimerRef.current ?? undefined);
        pollTimerRef.current = null;

        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
          ytPlayerRef.current = null;
        }

        useVideoPlayerStore.getState().resetVideoState();
        setActiveSlide(null);
        activeSlideRef.current = null;
        const resetSnap: VideoStateEvent = { paused: true, currentTime: 0, duration: 0, volume: 1 };
        for (const target of ["main", "projector", "return"]) {
          void emitTo(target, "video-state", resetSnap).catch(() => {});
        }
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Keep every webview's videoPlaybackTargets in sync. The Rust handler emits
  // `remote-video-set-targets` globally, but only the main window's remote
  // bridge was consuming it; projector and return windows kept their default.
  useEffect(() => {
    const unsub = listen<{ targets: string[] }>("remote-video-set-targets", (e) => {
      if (e.payload && Array.isArray(e.payload.targets)) {
        const validTargets = e.payload.targets.filter(
          (t): t is "main" | "projector" | "return" =>
            t === "main" || t === "projector" || t === "return",
        );
        useVideoPlayerStore.getState().setVideoPlaybackTargets(validTargets);
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen to slide-cleared: fully reset ONLY if we were actually playing a video.
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      if (!activeSlideRef.current) return;

      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;

      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_) { /* ignore */ }
        ytPlayerRef.current = null;
      }

      // For local video: clearing activeSlide unmounts LocalVideoMaster
      useVideoPlayerStore.getState().resetVideoState();
      setActiveSlide(null);
      activeSlideRef.current = null;
      const resetSnap: VideoStateEvent = { paused: true, currentTime: 0, duration: 0, volume: 1 };
      for (const target of ["main", "projector", "return"]) {
        void emitTo(target, "video-state", resetSnap).catch(() => {});
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // Listen to video-control for YouTube (local video handled in LocalVideoMaster)
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const { action, value } = e.payload;

      if (action === "seek") {
        seekingRef.current = true;
        setTimeout(() => { seekingRef.current = false; }, 500);
      }

      if (ytPlayerRef.current) {
        const p = ytPlayerRef.current;
        if (action === "play") {
          p.playVideo();
          for (const target of ["projector", "return"] as const) {
            void emitTo(target, "video-control-cmd", { action: "play" }).catch(() => {});
          }
        } else if (action === "pause") {
          p.pauseVideo();
          for (const target of ["projector", "return"] as const) {
            void emitTo(target, "video-control-cmd", { action: "pause" }).catch(() => {});
          }
        } else if (action === "seek" && value !== undefined) {
          p.seekTo(value, true);
          for (const target of ["projector", "return"] as const) {
            void emitTo(target, "video-control-cmd", { action: "seek", value }).catch(() => {});
          }
        } else if (action === "volume" && value !== undefined) {
          p.setVolume(Math.round(value * 100));
        }
      }
    }).catch(() => () => {});
    return () => { void unsub.then((fn) => fn()); };
  }, []);

  // ── YouTube player lifecycle ──────────────────────────────────────────────

  const activeVideoId = activeSlide?.slideType === "onlineVideo" && activeSlide.source !== "local" ? activeSlide.video_id : undefined;
  const activeVideoSource = activeSlide?.slideType === "onlineVideo" ? activeSlide.source : undefined;

  useEffect(() => {
    const videoId = activeVideoId ?? null;
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

    console.log("[PersistentVideoPlayer] creating YT master for", videoId);
    void loadYouTubeAPI().then(() => {
      if (destroyed || !container.isConnected) {
        console.warn("[PersistentVideoPlayer] skipping YT create — destroyed=", destroyed, "connected=", container.isConnected);
        return;
      }
      if (!window.YT || !window.YT.Player) {
        console.error("[PersistentVideoPlayer] window.YT.Player unavailable after loadYouTubeAPI");
        return;
      }

      const player = new window.YT.Player(uid, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1, controls: 0, rel: 0,
          modestbranding: 1, showinfo: 0,
          disablekb: 1, iv_load_policy: 3, cc_load_policy: 0,
          // Start muted so WKWebView/browser autoplay policy doesn't block.
          // We unmute on first state-change to "playing".
          mute: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            console.log("[PersistentVideoPlayer] YT onReady for", videoId);
            if (destroyed) return;
            ytPlayerRef.current = target;
            const iframe = target.getIframe();
            iframe.style.cssText =
              "width:100%;height:100%;pointer-events:none;border:none;" +
              "transform:scale(1.06);transform-origin:center;display:block;";

            pollTimerRef.current = setInterval(() => {
              if (target.getPlayerState() !== 1) return; // only heartbeat while playing
              const snap: VideoStateEvent = {
                paused: false,
                currentTime: target.getCurrentTime(),
                duration: target.getDuration(),
                volume: target.getVolume() / 100,
              };
              broadcastState(snap, { videoId, videoSrc: null, videoSource: "youtube" });
            }, HEARTBEAT_INTERVAL_MS);
          },
          onStateChange: ({ data, target }) => {
            console.log("[PersistentVideoPlayer] YT onStateChange", data, "for", videoId);
            if (destroyed) return;
            seekingRef.current = false;
            // Unmute on first transition to PLAYING (1) — bypasses autoplay policy.
            if (data === 1 && target.isMuted && target.isMuted()) {
              try { target.unMute?.(); } catch (_) { /* ignore */ }
            }
            const snap: VideoStateEvent = {
              paused: data !== 1,
              currentTime: target.getCurrentTime(),
              duration: target.getDuration(),
              volume: target.getVolume() / 100,
            };
            broadcastState(snap, { videoId, videoSrc: null, videoSource: "youtube" }, true);
            // data === 0 means ENDED
            if (data === 0) {
              handleVideoEnded();
            }
          },
          onError: ({ data }) => {
            console.error("[PersistentVideoPlayer] YT onError", data, "for", videoId);
          },
        },
      });
      ytPlayerRef.current = player;
    }).catch((err) => {
      console.error("[PersistentVideoPlayer] loadYouTubeAPI failed:", err);
    });

    return () => {
      destroyed = true;
      clearInterval(pollTimerRef.current ?? undefined);
      pollTimerRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch (_) { /* ignore */ }
      ytPlayerRef.current = null;
      container.remove();
    };
  }, [activeVideoId, activeVideoSource, broadcastState, playSessionId]);

  const isLocalVideo = activeSlide?.slideType === "onlineVideo" && activeSlide.source === "local" && !!activeSlide.url;
  const localVideoUrl = activeSlide?.slideType === "onlineVideo" ? activeSlide.url : null;

  return (
    <div
      ref={playerHostRef}
      aria-hidden
      style={RESTING_STYLE}
    >
      {isLocalVideo && localVideoUrl && (
        <LocalVideoMaster
          videoPath={localVideoUrl}
          onBroadcast={broadcastLocalState}
        />
      )}
    </div>
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
