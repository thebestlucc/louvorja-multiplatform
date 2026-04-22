import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getPreferenceSync, setPreference } from "../lib/store";
import * as videoPipeline from "../lib/tauri/video-pipeline";
import { useRustVideoPipelineStore } from "./rust-video-pipeline-store";

export type LoopMode = "none" | "one";

interface VideoPlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  videoId: string | null;
  videoSrc: string | null;
  videoSource: "youtube" | "local" | null;
  useRustVideoPipeline: boolean;
  loopMode: LoopMode;
  setVideoState: (partial: Partial<Omit<VideoPlayerState, "setVideoState" | "resetVideoState" | "setUseRustVideoPipeline" | "useRustVideoPipeline" | "loopMode" | "setLoopMode">>) => void;
  resetVideoState: () => void;
  setUseRustVideoPipeline: (v: boolean) => void;
  setLoopMode: (mode: LoopMode) => void;
}

type VideoPlayerData = Pick<VideoPlayerState, "currentTime" | "duration" | "paused" | "volume" | "videoId" | "videoSrc" | "videoSource">;

const USE_RUST_VIDEO_PIPELINE_KEY = "use_rust_video_pipeline";
const VIDEO_LOOP_MODE_KEY = "video_loop_mode";

const initialState: VideoPlayerData = {
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  videoId: null,
  videoSrc: null,
  videoSource: null,
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,
  useRustVideoPipeline: getPreferenceSync<boolean>(USE_RUST_VIDEO_PIPELINE_KEY, false),
  loopMode: getPreferenceSync<LoopMode>(VIDEO_LOOP_MODE_KEY, "none"),
  setVideoState: (partial) => set(partial),
  resetVideoState: () => set(initialState),
  setUseRustVideoPipeline: (v) => {
    const prev = useVideoPlayerStore.getState().useRustVideoPipeline;
    set({ useRustVideoPipeline: v });
    setPreference(USE_RUST_VIDEO_PIPELINE_KEY, v);
    if (prev && !v) {
      videoPipeline.unload().catch(() => {});
      // Direct reset is acceptable here: same domain, no circular dep, 1 line.
      // If more reset logic is needed in future, extract to useVideoCoordinator.
      useRustVideoPipelineStore.getState().reset();
    }
  },
  setLoopMode: (mode) => {
    set({ loopMode: mode });
    setPreference(VIDEO_LOOP_MODE_KEY, mode);
    // Mirror to Rust pipeline only when the flag is on; legacy HTML5 path
    // does not implement loop (rolled back in dc942d3).
    if (useVideoPlayerStore.getState().useRustVideoPipeline) {
      videoPipeline.setLoop(mode).catch((err) => console.error("[video-pipeline] setLoop", err));
    }
  },
}));

// ─── Streaming sync ────────────────────────────────────────────────────────────
// Forward video state changes to the streaming SSE server so external browsers
// (OBS, etc.) can synchronize playback. Throttled to at most once per 500 ms
// to avoid flooding the SSE channel during time-update events.

let _streamingThrottleTimer: ReturnType<typeof setTimeout> | null = null;
let _lastStreamingAction = "";

function forwardVideoStateToStreaming(state: VideoPlayerData, action: string) {
  // "state" events are throttled; play/pause/seek are sent immediately as "cmd"
  const isStateUpdate = action === "state";
  const eventType = isStateUpdate ? "state" : "cmd";

  const payload = {
    eventType,
    action,
    currentTime: state.currentTime,
    duration: state.duration,
    paused: state.paused,
    volume: state.volume,
    videoId: state.videoId ?? undefined,
    videoSource: state.videoSource ?? undefined,
  };

  invoke("broadcast_video_state_to_streaming", { payload }).catch(() => {});
}

export const __unsubStreaming = useVideoPlayerStore.subscribe((state, prev) => {
  // Skip if no video is active
  if (!state.videoSource) return;

  const pausedChanged = state.paused !== prev.paused;
  const videoChanged = state.videoId !== prev.videoId || state.videoSrc !== prev.videoSrc || state.videoSource !== prev.videoSource;
  const timeChanged = Math.abs(state.currentTime - prev.currentTime) > 0.5;

  if (videoChanged || (!state.paused && !prev.paused && !timeChanged && !pausedChanged)) {
    // No meaningful change in time, not a new video — skip
    if (!videoChanged) return;
  }

  let action = "state";
  if (pausedChanged) {
    action = state.paused ? "pause" : "play";
  } else if (videoChanged) {
    action = "state";
  }

  // Throttle continuous time-update "state" events to once per 500 ms
  if (action === "state" && !videoChanged) {
    if (_streamingThrottleTimer) return;
    _streamingThrottleTimer = setTimeout(() => {
      _streamingThrottleTimer = null;
      const current = useVideoPlayerStore.getState();
      if (current.videoSource) {
        forwardVideoStateToStreaming(current, "state");
      }
    }, 500);
    return;
  }

  // Debounce repeated identical actions
  if (action === _lastStreamingAction && !videoChanged) {
    if (_streamingThrottleTimer) clearTimeout(_streamingThrottleTimer);
    _streamingThrottleTimer = setTimeout(() => {
      _streamingThrottleTimer = null;
      _lastStreamingAction = "";
    }, 100);
  }

  _lastStreamingAction = action;
  forwardVideoStateToStreaming(state, action);
});

/** Internal: clear any pending streaming-throttle timer. Used by HMR cleanup. */
export function __clearStreamingThrottle() {
  if (_streamingThrottleTimer) {
    clearTimeout(_streamingThrottleTimer);
    _streamingThrottleTimer = null;
  }
}
