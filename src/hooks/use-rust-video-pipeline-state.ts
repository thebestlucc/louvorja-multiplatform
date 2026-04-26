// App-wide bridge that forwards the Rust pipeline's 10 Hz `videoPipelineState`
// and one-shot `videoPipelineEnded` events into a small Zustand store consumed
// by the Playing Now UI when the `useRustVideoPipeline` flag is on.
//
// Also subscribes to `video-pipeline-error` events emitted by the rust runtime
// when `video_pipeline_load` (which spawns a thread and returns Ok(()) before
// the thread finishes) hits a fatal error — without this listener, "file not
// found" or YouTube resolution failures only surface as `log::warn!` lines and
// the user just sees a black screen with no feedback.
//
// Mounted ONCE in `__root.tsx` so the store stays fresh whenever the app is
// alive, regardless of which route is mounted.
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { events } from "../lib/bindings";
import { useRustVideoPipelineStore } from "../stores/rust-video-pipeline-store";
import { useMediaPlayerStore } from "../stores/media-player-store";

/** Payload contract for the `video-pipeline-error` event emitted by Rust. */
interface VideoPipelineErrorPayload {
  kind: "not_found" | "internal";
  message: string;
}

/** Payload contract for the `video-pipeline-frame-ready` event emitted by Rust. */
interface VideoPipelineFrameReadyPayload {
  ready: boolean;
}

/**
 * Safety-net timeout for video-only sources where the audio_sink probe never
 * fires. Without this, projection windows would hold a stale slide forever.
 * 5s is generous (typical first-buffer latency is <2s for online videos),
 * tight enough that "no audio in this stream" doesn't ruin the user's flow.
 */
const FRAME_READY_TIMEOUT_MS = 5000;

export function useRustVideoPipelineStateBridge() {
  const { t } = useTranslation();

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;
    // Safety-net timer: if audio_sink probe never fires (e.g. video-only
    // source), we still need to release the held slide eventually. Cleared
    // on every `ready: true` (probe fired) and rearmed on every `ready: false`
    // (new load started).
    let frameReadyTimeout: ReturnType<typeof setTimeout> | null = null;

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

          const mpStore = useMediaPlayerStore.getState();

          // Drive the playing-now seek bar with Rust pipeline position.
          // Only update when timelineSource is "video" — when audio is active
          // that source owns the timeline and we must not override it.
          if (mpStore.timelineSource === "video") {
            mpStore.updateTimeline(
              event.payload.positionSecs * 1000,
              event.payload.durationSecs * 1000,
              "video",
            );
          }

          // Mirror status to media-player-store so ControlBar reflects actual
          // pipeline state. Only flip status when the new state is different
          // (avoids re-render churn) and only from `playing|paused|loading` —
          // never overwrite `idle|error|ended` (managed elsewhere).
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

        // `video-pipeline-error` is not yet in the typed `events` bindings (it
        // is emitted via raw `app.emit("video-pipeline-error", ...)` from
        // Rust). Use the untyped `listen()` until tauri-specta picks it up so
        // this hook works regardless of bindings regeneration order.
        const u3 = await listen<VideoPipelineErrorPayload>(
          "video-pipeline-error",
          (event) => {
            const payload = event.payload;
            // Defensive: payload may arrive in unexpected shape if the Rust
            // contract drifts. Default to "internal" so the user still sees
            // *something* rather than a silent failure.
            const kind: VideoPipelineErrorPayload["kind"] =
              payload?.kind === "not_found" ? "not_found" : "internal";
            const message = payload?.message ?? "";

            // Reflect error state in the media player so ControlBar disables
            // any pending action — without this, the bar stays in `loading`
            // forever waiting for a `videoPipelineState` event that won't
            // arrive when load() failed before the pipeline started.
            useMediaPlayerStore.getState().setStatus("error");

            if (kind === "not_found") {
              toast.error(t("videoPipeline.errorNotFoundTitle"), {
                description: message || t("videoPipeline.errorNotFoundDescription"),
                duration: Infinity,
              });
            } else {
              toast.error(t("videoPipeline.errorInternalTitle"), {
                description: message || t("videoPipeline.errorInternalDescription"),
                duration: 10000,
              });
            }
          },
        );

        // `video-pipeline-frame-ready` — emitted by Rust `runtime::load()` at
        // start (`{ ready: false }`) and from a one-shot pad probe on the
        // audio sink's first buffer (`{ ready: true }`). Drives the buffered
        // slide pattern in `projector-view.tsx` + `return.tsx`: hold pending
        // onlineVideo slides until pipeline is producing samples, then swap.
        const u4 = await listen<VideoPipelineFrameReadyPayload>(
          "video-pipeline-frame-ready",
          (event) => {
            const ready = !!event.payload?.ready;
            useRustVideoPipelineStore.getState().setState({ isFrameReady: ready });

            if (frameReadyTimeout) {
              clearTimeout(frameReadyTimeout);
              frameReadyTimeout = null;
            }
            if (!ready) {
              // Arm the safety-net timeout. If audio_sink never produces a
              // buffer (video-only source, broken upstream, etc.) we still
              // release the held slide after `FRAME_READY_TIMEOUT_MS` so the
              // operator isn't stuck on stale content.
              frameReadyTimeout = setTimeout(() => {
                console.warn(
                  `[video-pipeline] frame-ready timeout (${FRAME_READY_TIMEOUT_MS}ms) — forcing isFrameReady=true`,
                );
                useRustVideoPipelineStore.getState().setState({ isFrameReady: true });
                frameReadyTimeout = null;
              }, FRAME_READY_TIMEOUT_MS);
            }
          },
        );

        if (cancelled) {
          u1();
          u2();
          u3();
          u4();
          return;
        }
        unlisteners.push(u1, u2, u3, u4);
      } catch (err) {
        console.error("[video-pipeline] failed to register state listeners", err);
      }
    })();

    return () => {
      cancelled = true;
      if (frameReadyTimeout) {
        clearTimeout(frameReadyTimeout);
        frameReadyTimeout = null;
      }
      for (const u of unlisteners) u();
    };
  }, [t]);
}
