import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface VideoPlayerState {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  videoId: string | null;
  videoSrc: string | null;
  videoSource: "youtube" | "local" | null;
  /** Which screens render live video. Default: projector only. Persisted via plugin-store. */
  videoPlaybackTargets: string[];
  setVideoState: (partial: Partial<Omit<VideoPlayerState, "setVideoState" | "resetVideoState" | "setVideoPlaybackTargets">>) => void;
  setVideoPlaybackTargets: (targets: string[]) => void;
  resetVideoState: () => void;
}

type VideoPlayerData = Pick<VideoPlayerState, "currentTime" | "duration" | "paused" | "volume" | "videoId" | "videoSrc" | "videoSource" | "videoPlaybackTargets">;

const initialState: VideoPlayerData = {
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  videoId: null,
  videoSrc: null,
  videoSource: null,
  videoPlaybackTargets: ["projector"],
};

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  ...initialState,
  setVideoState: (partial) => set(partial),
  setVideoPlaybackTargets: (targets) => set({ videoPlaybackTargets: targets }),
  resetVideoState: () => set(initialState),
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

const _unsubStreaming = useVideoPlayerStore.subscribe((state, prev) => {
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _unsubStreaming();
    if (_streamingThrottleTimer) {
      clearTimeout(_streamingThrottleTimer);
      _streamingThrottleTimer = null;
    }
  });
}
