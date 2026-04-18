// App-wide bridge that forwards the Rust pipeline's 10 Hz `videoPipelineState`
// and one-shot `videoPipelineEnded` events into a small Zustand store consumed
// by the Playing Now UI when the `useRustVideoPipeline` flag is on.
//
// Mounted ONCE in `__root.tsx` so the store stays fresh whenever the app is
// alive, regardless of which route is mounted.
import { useEffect } from "react";
import { events } from "../lib/bindings";
import { useRustVideoPipelineStore } from "../stores/rust-video-pipeline-store";

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
