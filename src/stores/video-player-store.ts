import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getPreferenceSync, setPreference, getPreference } from "../lib/store";
import * as videoPipeline from "../lib/tauri/video-pipeline";
import { useRustVideoPipelineStore } from "./rust-video-pipeline-store";

/**
 * Cross-webview event broadcast when the rust-video-pipeline flag flips. Each
 * Tauri webview owns a *separate* Zustand store + plugin-store cache, so a
 * `setUseRustVideoPipeline` call on the main window only updates main's store
 * + persists to disk. Projector + return webviews keep their stale value
 * until restart — the user reported this as "projector and return play the
 * video independently of the playing-now controls or the audio". We fix the
 * desync by emitting `video-pipeline:flag-changed` on every flag flip and
 * having every webview listen for it (see [`startVideoPlayerCrossWindowSync`]).
 */
const FLAG_CHANGED_EVENT = "video-pipeline:flag-changed";

interface FlagChangedPayload {
  useRustVideoPipeline: boolean;
}

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
    if (prev === v) return;
    // FB-1: persist → broadcast → unload → set local. The previous order
    // (`set local` first, then async persist + broadcast) created a window
    // where main's React tree had already re-rendered with the new flag
    // and could fire `attach_window` against the rust pipeline before the
    // unload + broadcast finished — projector attached to a stale/empty
    // pipeline depending on which followed which. Persisting first means
    // any follower webview that re-reads disk during the broadcast handler
    // (or mounts later) sees the new value; broadcasting before the local
    // set means projector + return webviews flip their stores BEFORE main
    // does, so by the time main's React tree re-renders the followers are
    // already in the target mode. When toggling OFF, unload runs after
    // broadcast so projection windows have already detached their native
    // sinks before the rust pipeline is torn down.
    setPreference(USE_RUST_VIDEO_PIPELINE_KEY, v)
      .catch((err) => console.error("[video-player-store] flag persist failed", err))
      .then(() =>
        invoke("set_video_pipeline_flag", { value: v }).catch((err) =>
          console.error("[video-player-store] flag broadcast failed", err),
        ),
      )
      .then(() => {
        if (prev && !v) {
          videoPipeline.unload().catch(() => {});
          useRustVideoPipelineStore.getState().reset();
        }
        set({ useRustVideoPipeline: v });
      });
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

/**
 * Re-read persisted preferences from the in-memory cache and apply them to
 * the store. Must be called from `bootstrap()` AFTER `initStorePreferences()`
 * populates the cache and BEFORE first render.
 *
 * Why this exists: Zustand's `create()` runs its initializer at module-load
 * time, which happens before `bootstrap()` awaits `initStorePreferences()`.
 * That race causes `getPreferenceSync()` to return the fallback (`false` /
 * `"none"`) on first read — so even when the user has the experimental Rust
 * video pipeline flag persisted as `true`, the store starts at `false` and
 * the legacy `<PersistentVideoPlayer>` mounts briefly during the first frame,
 * trying to load a (possibly missing) local video file and surfacing 404
 * errors before the eventual flag flip unmounts it.
 */
export function hydrateVideoPlayerPreferences(): void {
  const useRust = getPreferenceSync<boolean>(USE_RUST_VIDEO_PIPELINE_KEY, false);
  const loop = getPreferenceSync<LoopMode>(VIDEO_LOOP_MODE_KEY, "none");
  useVideoPlayerStore.setState({
    useRustVideoPipeline: useRust,
    loopMode: loop,
  });
  // Observability: log the post-hydration flag value PER WEBVIEW so dogfood
  // can confirm projector + return read the same value as main. Removing this
  // is fine once the cross-webview-sync regression has stayed dead for a
  // release cycle — leaving it costs ~1 console line per window open.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const label = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? "?";
  console.log(`[video-player-store] hydrated on '${label}': useRustVideoPipeline=${useRust} loopMode=${loop}`);
}

/**
 * Re-read the flag from disk (bypassing the in-memory `getPreferenceSync`
 * cache) and apply it. Used by the cross-webview sync listener as a defensive
 * fallback when an event arrives but the payload shape is unexpected — we
 * always have the source-of-truth on disk to fall back on. Also called by
 * projector / return windows when they lose focus and regain it, in case a
 * flag flip happened on main while they were backgrounded.
 */
export async function refreshVideoPlayerPreferencesFromDisk(): Promise<void> {
  const useRust = await getPreference<boolean>(USE_RUST_VIDEO_PIPELINE_KEY, false);
  const loop = await getPreference<LoopMode>(VIDEO_LOOP_MODE_KEY, "none");
  useVideoPlayerStore.setState({
    useRustVideoPipeline: useRust,
    loopMode: loop,
  });
}

/**
 * Mount the cross-webview Zustand sync listener so flag changes on the main
 * window propagate live to projector + return webviews. Must be called once
 * per webview from `bootstrap()` after `hydrateVideoPlayerPreferences`.
 *
 * Returns the unlisten function so HMR / shutdown paths can dispose it (we
 * don't bother in `bootstrap()` because the webview tearing down also tears
 * down the listener naturally).
 *
 * Without this listener, the symptom from P3.11 reappears: the user toggles
 * the flag on main, then opens the projector — projector's webview stays on
 * the legacy follower path because nothing pushed the new flag value into
 * its Zustand store. The disk-backed `getPreferenceSync` cache is also stale
 * (populated once at `initStorePreferences()` time, never refreshed).
 */
export async function startVideoPlayerCrossWindowSync(): Promise<() => void> {
  const unlisten = await listen<FlagChangedPayload>(FLAG_CHANGED_EVENT, (event) => {
    const v = event.payload?.useRustVideoPipeline;
    if (typeof v !== "boolean") {
      // Unexpected payload — re-read from disk as the safer fallback.
      refreshVideoPlayerPreferencesFromDisk().catch((err) =>
        console.error("[video-player-store] refresh from disk after bad payload", err),
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? "?";
    console.log(`[video-player-store] flag-changed on '${label}': useRustVideoPipeline=${v}`);
    useVideoPlayerStore.setState({ useRustVideoPipeline: v });
  });
  // P3.12 — defensive replay: read the flag from disk immediately AFTER the
  // listener is registered. Catches any flip that happened in the gap between
  // bootstrap's hydration and listener registration (typically <50 ms but the
  // window matters when the user toggles the flag right before opening the
  // projector). Bypasses the in-memory cache via `getPreference()`.
  await refreshVideoPlayerPreferencesFromDisk().catch((err) =>
    console.error("[video-player-store] post-listen refresh failed", err),
  );
  return unlisten;
}

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
