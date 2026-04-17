// src/components/online-videos/persistent-video-player.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, emit, emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { useMediaPlayerStore } from "../../stores/media-player-store";
import { useQueueStore } from "../../stores/queue-store";
import { useVideoSource } from "../../hooks/use-video-source";
import { clearCurrentSlide } from "../../lib/tauri/display";
import type { OnlineVideoMediaItem, OfflineVideoMediaItem } from "../../types/media";
import type { SlideContent } from "../../lib/bindings";
import type { VideoControlEvent, VideoStateEvent } from "./online-video-slide";

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
  const { loop } = useVideoPlayerStore.getState();
  if (loop) return; // native loop attribute handles restart
  if (hasNextQueueItem()) {
    useQueueStore.getState().next();
  } else {
    clearCurrentSlide().catch(() => {});
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
  const loop = useVideoPlayerStore((s) => s.loop);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onBroadcastRef = useRef(onBroadcast);
  onBroadcastRef.current = onBroadcast;

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    localVideoMasterRef.current = el;
  }, []);

  // Listen to video-control events and apply to local video element.
  // Followers sync via video-state broadcasts driven by native DOM events —
  // no need to re-emit video-control-cmd here.
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const video = videoRef.current;
      if (!video) return;
      const { action, value } = e.payload;
      if (action === "play") {
        video.play().catch(() => {});
      } else if (action === "pause") {
        video.pause();
      } else if (action === "seek" && value !== undefined) {
        video.currentTime = value;
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
      loop={loop}
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
 * Main window never renders live video. The only DOM it hosts is the hidden
 * <LocalVideoMaster> audio/timer master when a local file is active. Live
 * YouTube is rendered in the projector or return window (whichever is the
 * current liveTarget) via OnlineVideoSlide.
 */
export function PersistentVideoPlayer() {
  // Only the main window hosts the master player. Projector/return get
  // followers via <FollowerVideoSlide> in slide-renderer.
  const windowLabel = getCurrentWebviewWindow().label;
  if (windowLabel !== "main") return null;
  return <PersistentVideoPlayerMain />;
}

function PersistentVideoPlayerMain() {
  const seekingRef = useRef(false);
  const [activeSlide, setActiveSlide] = useState<SlideContent | null>(null);
  const activeSlideRef = useRef<SlideContent | null>(null);

  // Helper: broadcast current player state to all windows + update Zustand store.
  // Must use emitTo() for each window — JS emit() only reaches the current webview.
  // Skips broadcasts while master is seeking (prevents state flood + follower seek storm).
  const broadcastState = useCallback((snap: VideoStateEvent, meta: { videoId: string | null; videoSrc: string | null; videoSource: "youtube" | "local" | null }, force = false) => {
    if (seekingRef.current && !force) return;
    // Strip broadcast-only fields (mode, masterTimestampMs) before persisting
    // to store — the store's `mode` is a different shape (VideoPlaybackMode | null).
    const { mode: _m, masterTimestampMs: _ts, ...storeSnap } = snap;
    useVideoPlayerStore.getState().setVideoState({ ...storeSnap, ...meta });
    const enriched = {
      ...snap,
      seeking: seekingRef.current,
      masterTimestampMs: performance.now(),
      mode: useVideoPlayerStore.getState().mode?.kind ?? null,
    };
    // Global emit so Rust event.rs can bridge video-state to WS clients.
    emit("video-state", enriched).catch(() => {});
    for (const target of ["projector", "return"] as const) {
      emitTo(target, "video-state", enriched).catch(() => {});
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

        // Mirror into video-player-store mode (Stage 2 cache-aware decisions + ControlBar UI)
        if (slide.source === "local" && slide.url) {
          useVideoPlayerStore.getState().setMode({
            kind: "local",
            path: slide.url,
            videoId: slide.video_id || null,
            title: slide.title ?? null,
          });
        } else if (slide.video_id) {
          useVideoPlayerStore.getState().setMode({
            kind: "live-youtube",
            videoId: slide.video_id,
            title: slide.title ?? null,
          });
        }
      } else if (activeSlideRef.current) {
        // Non-video slide replaced the video: fully stop and clean up
        useVideoPlayerStore.getState().resetVideoState();
        useVideoPlayerStore.getState().setMode(null);
        setActiveSlide(null);
        activeSlideRef.current = null;
        const resetSnap: VideoStateEvent = {
          paused: true,
          currentTime: 0,
          duration: 0,
          volume: 1,
          seeking: false,
          masterTimestampMs: performance.now(),
          mode: null,
        };
        for (const target of ["projector", "return"] as const) {
          emitTo(target, "video-state", resetSnap).catch(() => {});
        }
        emit("video-state", resetSnap).catch(() => {});
      }
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, []);

  // Keep every webview's videoPlaybackTargets in sync. The Rust handler emits
  // `remote-video-set-targets` globally, but only the main window's remote
  // bridge was consuming it; projector and return windows kept their default.
  useEffect(() => {
    const unsub = listen<{ targets: string[] }>("remote-video-set-targets", (e) => {
      if (e.payload && Array.isArray(e.payload.targets)) {
        const validTargets = e.payload.targets.filter(
          (t): t is "projector" | "return" =>
            t === "projector" || t === "return",
        );
        useVideoPlayerStore.getState().setVideoPlaybackTargets(validTargets);
      }
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, []);

  // Keep every webview's liveTarget in sync (live-YouTube mode).
  useEffect(() => {
    const unsub = listen<{ target: "projector" | "return" }>(
      "remote-video-set-live-target",
      (e) => {
        if (e.payload && typeof e.payload.target === "string") {
          const valid: Array<"projector" | "return"> = ["projector", "return"];
          if (valid.includes(e.payload.target)) {
            useVideoPlayerStore.getState().setLiveTarget(e.payload.target);
          }
        }
      },
    ).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, []);

  // Listen to slide-cleared: fully reset ONLY if we were actually playing a video.
  useEffect(() => {
    const unsub = listen("slide-cleared", () => {
      if (!activeSlideRef.current) return;

      // For local video: clearing activeSlide unmounts LocalVideoMaster
      useVideoPlayerStore.getState().resetVideoState();
      useVideoPlayerStore.getState().setMode(null);
      setActiveSlide(null);
      activeSlideRef.current = null;
      const resetSnap: VideoStateEvent = {
        paused: true,
        currentTime: 0,
        duration: 0,
        volume: 1,
        seeking: false,
        masterTimestampMs: performance.now(),
        mode: null,
      };
      for (const target of ["projector", "return"] as const) {
        emitTo(target, "video-state", resetSnap).catch(() => {});
      }
      emit("video-state", resetSnap).catch(() => {});
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, []);

  // Listen to video-control for YouTube (local video handled in LocalVideoMaster).
  // YT iframe now lives in projector/return window, so main forwards the event.
  useEffect(() => {
    const unsub = listen<VideoControlEvent>("video-control", (e) => {
      const { action } = e.payload;

      if (action === "seek") {
        seekingRef.current = true;
        setTimeout(() => { seekingRef.current = false; }, 500);
      }

      const snapshot = useVideoPlayerStore.getState();
      const m = snapshot.mode;
      const lt = snapshot.liveTarget;

      // Live-YouTube mode: forward control to the window that owns the iframe.
      if (m?.kind === "live-youtube" && (lt === "projector" || lt === "return")) {
        emitTo(lt, "video-control", e.payload).catch(() => {});
        return;
      }
      // Local mode handled by LocalVideoMaster; nothing else to do here.
    }).catch(() => () => {});
    return () => { unsub.then((fn) => fn()).catch(() => {}); };
  }, []);

  const isLocalVideo = activeSlide?.slideType === "onlineVideo" && activeSlide.source === "local" && !!activeSlide.url;
  const localVideoUrl = activeSlide?.slideType === "onlineVideo" ? activeSlide.url : null;

  if (!isLocalVideo || !localVideoUrl) return null;

  return (
    <LocalVideoMaster
      videoPath={localVideoUrl}
      onBroadcast={broadcastLocalState}
    />
  );
}
