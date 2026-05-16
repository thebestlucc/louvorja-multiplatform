// Minimal Zustand store mirroring the 10 Hz `VideoPipelineState` event stream
// emitted by the Rust GStreamer pipeline. Used by the Playing Now UI when the
// `useRustVideoPipeline` feature flag is on. Per-session realtime data — no
// persistence (see Task 2.3 in `docs/plans/2026-04-17-rust-video-pipeline.md`).
import { create } from "zustand";

interface RustVideoPipelineState {
  positionSecs: number;
  durationSecs: number;
  paused: boolean;
  volume: number;
  /** True after a `videoPipelineEnded` event; cleared on the next state tick. */
  ended: boolean;
  /**
   * True once the Rust pipeline's audio sink has received its first buffer
   * for the current load — i.e. the GStreamer surface is actually rendering
   * content. Reset to false on every new `load()` (Rust emits
   * `video-pipeline-frame-ready { ready: false }` at the start of the load
   * worker, then `{ ready: true }` from a one-shot pad probe on the audio
   * sink's first buffer). Projection windows hold back `onlineVideo` slides
   * until this flips true so the operator never sees the black gap between
   * "click project" and "first frame".
   */
  isFrameReady: boolean;
  setState: (
    s: Partial<Omit<RustVideoPipelineState, "setState" | "reset">>,
  ) => void;
  reset: () => void;
}

const initial = {
  positionSecs: 0,
  durationSecs: 0,
  paused: true,
  volume: 1,
  ended: false,
  isFrameReady: false,
};

export const useRustVideoPipelineStore = create<RustVideoPipelineState>(
  (set) => ({
    ...initial,
    setState: (s) => set(s),
    reset: () => set(initial),
  }),
);
