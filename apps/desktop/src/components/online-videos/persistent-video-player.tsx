// src/components/online-videos/persistent-video-player.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { useProjectionState } from "../../hooks/use-projection-state";
import type { YTPlayer } from "../../lib/youtube-api";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { YouTubeMaster } from "./youtube-master";
import { useQueueStore } from "../../stores/queue-store";
import { useVideoSource } from "../../hooks/use-video-source";
import { clearCurrentSlide } from "../../lib/tauri/display";
import type { SlideContent } from "../../lib/bindings";
import type { VideoControlEvent, VideoStateEvent } from "./online-video-slide";

/** Heartbeat interval for progress bar updates and drift detection (ms). */
const HEARTBEAT_INTERVAL_MS = 100;

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

/** Clears projection screens when a video ends with no next queue item. */
function handleVideoEnded() {
  if (!hasNextQueueItem()) {
    clearCurrentSlide();
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

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return;
    // High-frequency broadcast while playing — browser onTimeUpdate is ~4Hz, too coarse
    // for tight follower sync. Emit every 100ms so followers can correct drift quickly.
    heartbeatRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      onBroadcastRef.current({
        paused: false,
        currentTime: v.currentTime,
        duration: v.duration || 0,
        volume: v.volume,
      });
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => stopHeartbeat(), [stopHeartbeat]);

  // Listen to video-control events and apply to local video element
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const video = videoRef.current;
      if (!video) return;
      const { action, value } = e.payload;
      if (action === "play") {
        video.play().catch(() => {});
        // Broadcast to all windows
        for (const target of ["main", "projector", "return"] as const) {
          emitTo(target, "video-control-cmd", { action: "play" }).catch(() => {});
        }
      } else if (action === "pause") {
        video.pause();
        for (const target of ["main", "projector", "return"] as const) {
          emitTo(target, "video-control-cmd", { action: "pause" }).catch(() => {});
        }
      } else if (action === "seek" && value !== undefined) {
        video.currentTime = value;
        for (const target of ["main", "projector", "return"] as const) {
          emitTo(target, "video-control-cmd", { action: "seek", value }).catch(() => {});
        }
      } else if (action === "volume" && value !== undefined) {
        video.volume = value;
      }
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
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
        startHeartbeat();
      }}
      onPause={(e) => {
        const v = e.currentTarget;
        onBroadcastRef.current({
          paused: true,
          currentTime: v.currentTime,
          duration: v.duration || 0,
          volume: v.volume,
        });
        stopHeartbeat();
      }}
      onEnded={(e) => {
        const v = e.currentTarget;
        onBroadcastRef.current({
          paused: true,
          currentTime: v.currentTime,
          duration: v.duration || 0,
          volume: v.volume,
        });
        stopHeartbeat();
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
    const enriched = { ...snap, seeking: seekingRef.current, emitTs: performance.now() };
    for (const target of ["main", "projector", "return"]) {
      emitTo(target, "video-state", enriched).catch(() => {});
    }
  }, []);

  // Callback for LocalVideoMaster to broadcast state
  const broadcastLocalState = useCallback((snap: VideoStateEvent) => {
    broadcastState(snap, { videoId: null, videoSrc: null, videoSource: "local" });
  }, [broadcastState]);

  const handleClear = useCallback(() => {
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
      emitTo(target, "video-state", resetSnap).catch(() => {});
    }
  }, []);

  const handleSlide = useCallback((slide: SlideContent) => {
    // When the rust pipeline owns playback, this component renders null
    // (see early return below) and `useOnlineVideoBridge` owns the
    // mpStore.load() + videoPipeline.load() bridge. Skip all legacy
    // bookkeeping so we don't double-load or leak refs.
    if (useVideoPlayerStore.getState().useRustVideoPipeline) {
      // Reset legacy refs in case the flag was just toggled mid-session.
      activeSlideRef.current = null;
      return;
    }

    if (slide.slideType === "onlineVideo") {
      // Increment session so YouTube player lifecycle effect re-runs even for
      // same videoId. Tracks legacy YT iframe + LocalVideoMaster lifecycle —
      // populating useMediaPlayerStore is the bridge's responsibility now.
      playSessionIdRef.current += 1;
      setPlaySessionId(playSessionIdRef.current);
      setActiveSlide(slide);
      activeSlideRef.current = slide;
    } else if (activeSlideRef.current) {
      // Non-video slide replaced the video: fully stop and clean up
      handleClear();
    }
  }, [handleClear]);

  // Hub-driven slide bridge (Phase 5). Reference-equality on
  // snapshot.currentSlide is safe (Phase 4 receipt): only swaps when a
  // slideChanged event arrives, so identical refs mean "no slide change."
  const projection = useProjectionState();
  const lastSlideRef = useRef<SlideContent | null>(null);
  useEffect(() => {
    if (!projection) return;
    const current = projection.currentSlide;
    if (current === lastSlideRef.current) return;
    lastSlideRef.current = current;
    if (current === null) {
      handleClear();
    } else {
      handleSlide(current);
    }
  }, [projection, handleSlide, handleClear]);

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
            emitTo(target, "video-control-cmd", { action: "play" }).catch(() => {});
          }
        } else if (action === "pause") {
          p.pauseVideo();
          for (const target of ["projector", "return"] as const) {
            emitTo(target, "video-control-cmd", { action: "pause" }).catch(() => {});
          }
        } else if (action === "seek" && value !== undefined) {
          p.seekTo(value, true);
          for (const target of ["projector", "return"] as const) {
            emitTo(target, "video-control-cmd", { action: "seek", value }).catch(() => {});
          }
        } else if (action === "volume" && value !== undefined) {
          p.setVolume(Math.round(value * 100));
        }
      }
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, []);

  // ── YouTube player lifecycle ──────────────────────────────────────────────

  const useRustPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);

  const activeVideoId = activeSlide?.slideType === "onlineVideo" && activeSlide.source !== "local" ? activeSlide.video_id : undefined;
  const activeVideoSource = activeSlide?.slideType === "onlineVideo" ? activeSlide.source : undefined;

  const isLocalVideo = activeSlide?.slideType === "onlineVideo" && activeSlide.source === "local" && !!activeSlide.url;
  const localVideoUrl = activeSlide?.slideType === "onlineVideo" ? activeSlide.url : null;

  // When the Rust GStreamer pipeline is active it owns audio output (autoaudiosink).
  // Rendering YouTubeMaster or LocalVideoMaster alongside it would produce double
  // audio and conflict with the Rust-path controls. Suppress HTML5 players entirely;
  // useSlideVersion / handleSlide still run so media-player-store stays populated.
  if (useRustPipeline) {
    return null;
  }

  return (
    <>
      <YouTubeMaster
        playerHostRef={playerHostRef}
        ytPlayerRef={ytPlayerRef}
        pollTimerRef={pollTimerRef}
        seekingRef={seekingRef}
        playSessionId={playSessionId}
        activeVideoId={activeVideoId}
        activeVideoSource={activeVideoSource}
        onBroadcast={broadcastState}
        onVideoEnded={handleVideoEnded}
      />
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
    </>
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
