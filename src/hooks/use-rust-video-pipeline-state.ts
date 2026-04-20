// App-wide bridge that forwards the Rust pipeline's 10 Hz `videoPipelineState`
// and one-shot `videoPipelineEnded` events into a small Zustand store consumed
// by the Playing Now UI when the `useRustVideoPipeline` flag is on.
//
// Mounted ONCE in `__root.tsx` so the store stays fresh whenever the app is
// alive, regardless of which route is mounted.
import { useEffect } from "react";
import { events } from "../lib/bindings";
import { useRustVideoPipelineStore } from "../stores/rust-video-pipeline-store";
import { useMediaPlayerStore } from "../stores/media-player-store";

export function useRustVideoPipelineStateBridge() {
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      try {
        const u1 = await events.videoPipelineState.listen((event) => {
          useRustVideoPipelineStore.getState().setState({
            positionSecs: event.payload.positionSecs,
            durationSecs: event.payload.durationSecs,
            paused: event.payload.paused,
            volume: event.payload.volume,
            ended: false,
          });

          // Mirror status to media-player-store so ControlBar reflects actual
          // pipeline state. Only flip status when the new state is different
          // (avoids re-render churn) and only from `playing|paused|loading` —
          // never overwrite `idle|error|ended` (managed elsewhere).
          const mpStore = useMediaPlayerStore.getState();
          const desiredStatus = event.payload.paused ? "paused" : "playing";
          if (
            mpStore.status !== desiredStatus &&
            (mpStore.status === "playing" ||
              mpStore.status === "paused" ||
              mpStore.status === "loading")
          ) {
            mpStore.setStatus(desiredStatus);
          }
        });
        const u2 = await events.videoPipelineEnded.listen(() => {
          useRustVideoPipelineStore.getState().setState({ ended: true });
        });
        if (cancelled) {
          u1();
          u2();
          return;
        }
        unlisteners.push(u1, u2);
      } catch (err) {
        console.error("[video-pipeline] failed to register state listeners", err);
      }
    })();

    return () => {
      cancelled = true;
      for (const u of unlisteners) u();
    };
  }, []);
}
