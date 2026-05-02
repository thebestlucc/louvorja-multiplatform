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
import { classifyVideoPipelineError } from "../lib/video-pipeline-errors";
import * as videoPipeline from "../lib/tauri/video-pipeline";

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
 * Phase 5 / Track 1 / Task 10 — payload contract for `video-pipeline-sink-degraded`.
 *
 * Mirrors the `VideoPipelineSinkDegraded` typed event in
 * `src-tauri/src/video_pipeline/events.rs`. Untyped `listen()` is used here
 * because `tauri-specta` regenerates `bindings.ts` on `pnpm tauri dev` — we
 * keep this hook compatible regardless of regen ordering, identical to the
 * `video-pipeline-error` pattern below.
 */
interface VideoPipelineSinkDegradedPayload {
  windowLabel: string;
  reason: string;
}

/**
 * Safety-net timeout for video-only sources where the audio_sink probe never
 * fires. Without this, projection windows would hold a stale slide forever.
 * 5s is generous (typical first-buffer latency is <2s for online videos),
 * tight enough that "no audio in this stream" doesn't ruin the user's flow.
 */
const FRAME_READY_TIMEOUT_MS = 5000;

/**
 * Phase 5 / Track 1 / Task 8 — minimum playback position required before a
 * non-paused state event is treated as confirmation that the pipeline is
 * actually producing samples (and we can clear the safety-net frame-ready
 * timeout early). Filters residual ticks from the *previous* video at end
 * of stream — those typically report a position close to the prior
 * duration before the new load resets the position to 0. Picked at 0.5s
 * because: (a) genuine playback always advances past it within ~30 frames
 * @ 60Hz state polling, (b) it's well below the 5s safety-net so we never
 * clear too late, (c) it's well above the residual end-of-stream tick
 * floor (which sits in the millisecond range before reset).
 */
const MIN_PROGRESS_FOR_FRAME_READY_SECS = 0.5;

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

          // Phase 5 / Track 1 / Task 8 — cancel frame-ready safety-net
          // timeout early when state-broadcaster confirms playback. Without
          // this, video-only streams (where the audio probe never fires)
          // wait the full 5s before unfreezing projection. The `>= 0.5`
          // threshold filters residual ticks from the prior video at end of
          // stream.
          if (
            frameReadyTimeout &&
            event.payload.positionSecs >= MIN_PROGRESS_FOR_FRAME_READY_SECS &&
            !event.payload.paused
          ) {
            clearTimeout(frameReadyTimeout);
            frameReadyTimeout = null;
            useRustVideoPipelineStore.getState().setState({ isFrameReady: true });
          }

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
        //
        // Phase 5 / Track 1 / Task 10 — every error message goes through the
        // shared `classifyVideoPipelineError` classifier. Buckets dictate the
        // toast shape AND the side-effect:
        //   - gl_color_convert    → call `videoPipeline.refreshSinks()` first;
        //                           on success, NO toast (silent recovery).
        //                           on failure, surface the bucket toast with
        //                           the action button still wired.
        //   - state_change_failed → no toast here. The single-flight gate's
        //                           auto-retry in `tauri/video-pipeline.ts::load()`
        //                           runs BEFORE this listener fires for transient
        //                           PAUSED failures. By the time we receive the
        //                           event, the retry already succeeded (no event)
        //                           or already failed (auto-retry was insufficient).
        //                           Show a short-duration toast as last-resort signal.
        //   - all other buckets   → infinite-duration toast with action button.
        const u3 = await listen<VideoPipelineErrorPayload>(
          "video-pipeline-error",
          (event) => {
            const payload = event.payload;
            const kind: VideoPipelineErrorPayload["kind"] =
              payload?.kind === "not_found" ? "not_found" : "internal";
            const message = payload?.message ?? "";

            // Compose what we feed the classifier. The Rust `kind` only
            // distinguishes `not_found` from `internal`; the `message`
            // carries the actual GStreamer text we want to pattern-match
            // against (e.g. "GstGLColorConvertElement: Failed to convert ...").
            //
            // IMPORTANT: classify FIRST, decide error-status SECOND. Setting
            // `status = "error"` unconditionally here caused ControlBar to
            // flicker into the error state for the recoverable buckets
            // (`gl_color_convert` silent recovery, `state_change_failed`
            // post-retry) during the async window before recovery resolved.
            // Only commit the error status for buckets that won't be
            // silently rehabilitated, OR when a recovery attempt fails.
            const classifierInput = kind === "not_found"
              ? `not found: ${message}`
              : message;
            const classification = classifyVideoPipelineError(classifierInput);

            // gl_color_convert — try silent recovery via refreshSinks before
            // touching status. Recovery success → user never sees the toast
            // and `status` stays whatever it was (typically `playing`).
            // Recovery failure → only NOW do we flip to `error` and toast.
            if (classification.bucket === "gl_color_convert") {
              const mpBefore = useMediaPlayerStore.getState();
              const wasError = mpBefore.status === "error";
              videoPipeline
                .refreshSinks()
                .then(() => {
                  // Silent recovery — if status was forced to `error` by an
                  // earlier event in this same window, drop it back to
                  // `paused` so ControlBar can resume reflecting actual
                  // pipeline state. Otherwise leave `status` untouched: the
                  // 10 Hz `videoPipelineState` listener owns playing/paused
                  // transitions and we must not race with it.
                  if (wasError) {
                    useMediaPlayerStore.getState().setStatus("paused");
                  }
                })
                .catch((refreshErr) => {
                  // Recovery failed — NOW we commit the error status and
                  // surface the toast with action button wired to a manual
                  // retry.
                  useMediaPlayerStore.getState().setStatus("error");
                  // eslint-disable-next-line no-console
                  console.warn(
                    "[video-pipeline] refreshSinks recovery failed",
                    refreshErr,
                  );
                  toast.error(t(classification.titleKey), {
                    description: `${t(classification.whyKey)} ${classification.rawMessage}`,
                    duration: Infinity,
                    action: {
                      label: t(classification.actionKey),
                      onClick: () => {
                        videoPipeline.refreshSinks().catch(() => {
                          /* manual retry — already surfaced; ignore */
                        });
                      },
                    },
                  });
                });
              return;
            }

            // state_change_failed — auto-retry in
            // `tauri/video-pipeline.ts::load()` runs BEFORE this listener
            // sees the event for transient PAUSED failures. By the time we
            // are here, the retry already failed. Surface a short toast
            // (5s), and ONLY now reflect the unrecovered error in status —
            // skipping the unconditional `setStatus("error")` avoids the
            // pre-retry flicker that confused users when the retry
            // succeeded silently moments later.
            if (classification.bucket === "state_change_failed") {
              useMediaPlayerStore.getState().setStatus("error");
              toast.error(t(classification.titleKey), {
                description: `${t(classification.whyKey)} ${classification.rawMessage}`,
                duration: 5000,
              });
              return;
            }

            // All other buckets — genuinely unrecoverable from this
            // listener's perspective. Reflect error state in the media
            // player so ControlBar disables pending actions, then surface
            // the pastoral toast with retry action button.
            useMediaPlayerStore.getState().setStatus("error");
            toast.error(t(classification.titleKey), {
              description: `${t(classification.whyKey)} ${classification.rawMessage}`,
              duration: Infinity,
              action: {
                label: t(classification.actionKey),
                onClick: () => {
                  // Generic recovery: tear down so the operator can re-project.
                  videoPipeline.unload().catch(() => {
                    /* idempotent cleanup; ignore failures */
                  });
                },
              },
            });
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

        // Phase 5 / Track 1 / Task 10 — `video-pipeline-sink-degraded` event.
        // Rust emits this when a per-window native sink falls back to
        // `fakesink` so the rest of the pipeline keeps running. UX: surface a
        // pastoral toast with a "reopen screen" action wired to
        // `videoPipeline.refreshSinks()`. Untyped `listen()` until tauri-specta
        // regenerates `bindings.ts` to include `videoPipelineSinkDegraded`.
        const u5 = await listen<VideoPipelineSinkDegradedPayload>(
          "video-pipeline-sink-degraded",
          (event) => {
            const { windowLabel, reason } = event.payload ?? {
              windowLabel: "",
              reason: "",
            };
            toast.warning(t("videoPipelineErrors.sinkDegraded.title"), {
              description: t("videoPipelineErrors.sinkDegraded.why", {
                window: windowLabel || "?",
                reason: reason || "?",
              }),
              duration: Infinity,
              action: {
                label: t("videoPipelineErrors.sinkDegraded.action"),
                onClick: () => {
                  videoPipeline.refreshSinks().catch((err) => {
                    // eslint-disable-next-line no-console
                    console.warn(
                      "[video-pipeline] sink-degraded retry failed",
                      err,
                    );
                  });
                },
              },
            });
          },
        );

        if (cancelled) {
          u1();
          u2();
          u3();
          u4();
          u5();
          return;
        }
        unlisteners.push(u1, u2, u3, u4, u5);
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
