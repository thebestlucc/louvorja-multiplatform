import { invoke } from "@tauri-apps/api/core";
import { commands, type AppErrorResponse, type MediaSource, type Result } from "../bindings";
import { classifyVideoPipelineError } from "../video-pipeline-errors";

function unwrap<T>(result: Result<T, AppErrorResponse>): T {
  if (result.status === "error") {
    // P3.19 — surface the *actual* Rust-side detail, not the generic
    // "An internal application error occurred." message that AppError's
    // serde impl always produces for the `Internal` variant. The detail
    // string carries the file:line + format!() context (e.g.
    // "video_pipeline.seek(12.300s) from Playing: gstreamer SeekFailed").
    // Without this, every loop / seek / restart failure surfaced a single
    // identical toast that gave the user (and dogfood reviewers) zero
    // diagnostic signal — and made it impossible to tell whether
    // earlier-round fixes (P3.13's improved format strings) had landed at
    // all. Composite "msg — details" so the toast is still self-contained
    // when displayed without a description body.
    const generic = "An internal application error occurred.";
    const baseMessage = result.error?.message ?? "video pipeline error";
    const details = result.error?.details ?? null;
    const composed =
      baseMessage === generic && details
        ? details
        : details && details !== baseMessage
          ? `${baseMessage} — ${details}`
          : baseMessage;
    throw new Error(composed);
  }
  return result.data;
}

/**
 * Subscribe a window to the Rust video pipeline. Triggers an SDP offer
 * to flow back via the `videoPipelineOffer` typed event.
 */
export async function subscribe(windowLabel: string): Promise<null> {
  return unwrap(await commands.videoPipelineSubscribe(windowLabel));
}

/**
 * Tear down the Rust-side WebRTC consumer for the given window.
 */
export async function unsubscribe(windowLabel: string): Promise<null> {
  return unwrap(await commands.videoPipelineUnsubscribe(windowLabel));
}

/**
 * Forward an SDP answer from the frontend `RTCPeerConnection` back to Rust.
 */
export async function sendAnswer(windowLabel: string, sdp: string): Promise<null> {
  return unwrap(await commands.videoPipelineAnswer(windowLabel, sdp));
}

/**
 * Forward a local ICE candidate from the frontend `RTCPeerConnection` to Rust.
 * For the end-of-candidates sentinel, callers should pass an empty string.
 */
export async function sendIce(
  windowLabel: string,
  candidate: string,
  sdpMLineIndex: number,
): Promise<null> {
  return unwrap(await commands.videoPipelineIce(windowLabel, candidate, sdpMLineIndex));
}

/**
 * Phase 5 / Track 1 / Task 4 — single-flight gate state.
 *
 * `pendingLoad` deduplicates identical concurrent calls (same URI returns the
 * existing promise) and serializes different-URI loads (await the in-flight
 * promise before issuing the new one) so the Rust pipeline never sees two
 * overlapping `video_pipeline_load` invocations.
 *
 * `loadGeneration` is bumped on every fresh load AND on `cancelPendingLoads()`.
 * It IS read at the gate-clear sites (timeout-promise expiry and
 * `Promise.race().finally`): each `load()` call captures the generation at
 * issue time and only clears `pendingLoad` if the generation still matches —
 * otherwise a concurrent `cancelPendingLoads()`/`unload()` has invalidated us
 * and we must NOT touch the gate state owned by a newer call. Without this
 * guard, a stale `finally` would null out `pendingLoad` after a fresh load
 * already populated it, defeating dedup for any subsequent identical call.
 */
let pendingLoad: { uri: string; promise: Promise<null> } | null = null;
let loadGeneration = 0;

const PENDING_LOAD_TIMEOUT_MS = 10000;

function mediaSourceUri(source: MediaSource): string {
  return source.type === "local"
    ? `local:${source.absolutePath}`
    : `youtube:${source.videoId}`;
}

/**
 * Phase 5 / Track 1 / Task 9 — dev-only ring buffer of recent `load()` calls
 * with caller stacks. Helps diagnose double-load races when reviewing the
 * console after a glitch.
 *
 * Stripped from production builds via the `__DEV__` build-time literal
 * (defined in `vite.config.ts` `define`). Vite inlines this as `false` in
 * production and Rollup/esbuild tree-shake the dead branch — verified by
 * grepping `dist/assets/*.js` for `__videoPipelineLoadHistory` (must be 0
 * matches). The `typeof` guard handles the unit-test CommonJS compile path
 * where `__DEV__` is unbound at runtime; the buffer is silently disabled in
 * tests, which never hit `load()` anyway.
 *
 * `import.meta.env.DEV` was rejected because the unit-test tsconfig uses
 * `module: "CommonJS"` and `import.meta` requires ES2020+ module mode.
 */
declare const __DEV__: boolean;

interface VideoPipelineLoadHistoryEntry {
  ts: number;
  uri: string;
  stack: string;
}

function recordLoadHistory(uri: string): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  const globalAny = globalThis as typeof globalThis & {
    __videoPipelineLoadHistory?: VideoPipelineLoadHistoryEntry[];
    __dumpVideoPipelineLoads?: () => void;
  };
  const buf = globalAny.__videoPipelineLoadHistory ?? [];
  buf.push({
    ts: performance.now(),
    uri,
    stack: new Error().stack ?? "",
  });
  while (buf.length > 10) buf.shift();
  globalAny.__videoPipelineLoadHistory = buf;
  if (!globalAny.__dumpVideoPipelineLoads) {
    globalAny.__dumpVideoPipelineLoads = () => {
      // eslint-disable-next-line no-console
      console.table(globalAny.__videoPipelineLoadHistory ?? []);
    };
  }
}

/**
 * Phase 5 / Track 1 / Task 4 — invalidate any in-flight load. The in-flight
 * `invoke()` cannot be aborted (Tauri IPC has no cancellation primitive), but
 * bumping `loadGeneration` and clearing `pendingLoad` prevents the next
 * `load()` call from chaining onto a doomed promise.
 *
 * Called by `unload()` so that "stop, then start a different video" doesn't
 * stall behind the previous load.
 */
export function cancelPendingLoads(): void {
  loadGeneration += 1;
  pendingLoad = null;
}

/**
 * Phase 5 / Track 1 / Task 6 — auto-retry transient `state_change_failed`
 * failures once with a 250ms backoff. Recovery flow:
 *
 *   attempt 1 → classify rejection → if `state_change_failed`:
 *     unload() (idempotent on Rust side, clears partial pipeline state)
 *     wait 250ms (gives GStreamer time to settle NULL → READY transitions)
 *     attempt 2 → surface result (success: silent, fail: caller sees toast)
 *
 * The retry stays INSIDE the single-flight gate by being part of the
 * `pendingLoad.promise` — callers that race the second attempt are
 * deduplicated against the same promise, never see "loaded then unloaded
 * then loading" intermediate states. Other buckets surface immediately.
 */
async function loadWithRetry(source: MediaSource, uri: string): Promise<null> {
  try {
    return await commands.videoPipelineLoad(source).then(unwrap);
  } catch (err) {
    const classification = classifyVideoPipelineError(err);
    if (classification.bucket !== "state_change_failed") {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[video-pipeline] state_change_failed (${uri}) — retrying after 250ms`,
    );
    // Best-effort cleanup of any partial pipeline state. `unload()` here would
    // recursively bump `loadGeneration` and clear our gate ownership; call the
    // raw command directly so the retry stays inside the same single-flight
    // window.
    try {
      await commands.videoPipelineUnload().then(unwrap);
    } catch {
      /* idempotent — unload may legitimately fail if pipeline is already torn down */
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    return await commands.videoPipelineLoad(source).then(unwrap);
  }
}

/**
 * Resolve `source` to a GStreamer URI and load it on the pipeline.
 *
 * Phase 5 / Track 1 / Task 4 — guarded by a single-flight gate:
 *   - Identical concurrent calls return the same promise (dedup).
 *   - Different-URI calls await the in-flight load first (serialize).
 *   - A 10s safety timeout force-resets the gate if Rust never settles
 *     (prevents permanent stuck state on a silent backend hang).
 *
 * Phase 5 / Track 1 / Task 6 — the inner invocation goes through
 * `loadWithRetry()` which transparently retries `state_change_failed`
 * once (250ms backoff). Callers see only the post-retry outcome.
 */
export async function load(source: MediaSource): Promise<null> {
  const uri = mediaSourceUri(source);
  recordLoadHistory(uri);

  // Dedup: identical URI is in-flight → return the same promise.
  if (pendingLoad && pendingLoad.uri === uri) {
    return pendingLoad.promise;
  }

  // Serialize: different URI in-flight → wait for it before issuing the new
  // load. Swallow its rejection — the previous caller already saw the error;
  // the new load should proceed regardless.
  if (pendingLoad) {
    await pendingLoad.promise.catch(() => {
      /* prior load failed; new load proceeds */
    });
  }

  loadGeneration += 1;
  const generation = loadGeneration;

  const invocation = loadWithRetry(source, uri);

  // 10s safety timeout — if the invoke() never settles, force-reset the gate.
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      console.warn(
        `[video-pipeline] load(${uri}) did not settle within ${PENDING_LOAD_TIMEOUT_MS}ms — force-resetting gate`,
      );
      if (pendingLoad?.uri === uri && loadGeneration === generation) {
        pendingLoad = null;
      }
      reject(new Error("video pipeline load timed out"));
    }, PENDING_LOAD_TIMEOUT_MS);
  });

  // Swallow the timeoutPromise rejection unconditionally. `Promise.race`
  // already routes the rejection through `guarded` for the legitimate
  // timeout-wins case; the bare `.catch(() => {})` covers the microscopic
  // race where the timer fires *just before* `clearTimeout()` runs in the
  // `finally` of an invocation-wins outcome — without this, that stray
  // rejection would surface as an unhandled-rejection warning.
  timeoutPromise.catch(() => {
    /* see comment above — swallow stray timer-vs-clear race rejections */
  });

  const guarded = Promise.race([invocation, timeoutPromise]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    // Only clear if THIS call still owns the gate. A concurrent
    // `cancelPendingLoads()` may have already cleared/replaced it.
    if (pendingLoad?.uri === uri && loadGeneration === generation) {
      pendingLoad = null;
    }
  });

  pendingLoad = { uri, promise: guarded };
  return guarded;
}

/** Transition the pipeline to PLAYING. */
export async function play(): Promise<null> {
  return unwrap(await commands.videoPipelinePlay());
}

/** Transition the pipeline to PAUSED. */
export async function pause(): Promise<null> {
  return unwrap(await commands.videoPipelinePause());
}

/** Seek the pipeline to `secs`. */
export async function seek(secs: number): Promise<null> {
  return unwrap(await commands.videoPipelineSeek(secs));
}

/**
 * Update the playback volume (0.0–1.0). Sets the `volume` property on the
 * live `audio_volume` element and mirrors to the state snapshot.
 */
export async function setVolume(volume: number): Promise<null> {
  return unwrap(await commands.videoPipelineSetVolume(volume));
}

/** Tear down the pipeline and reset the snapshot. */
export async function unload(): Promise<null> {
  // Phase 5 / Track 1 / Task 4 — invalidate any in-flight load gate so that a
  // follow-up load() doesn't chain onto a now-irrelevant promise.
  cancelPendingLoads();
  return unwrap(await commands.videoPipelineUnload());
}

/** Seek to 0 and resume PLAYING (Task 3.1). */
export async function restart(): Promise<null> {
  return unwrap(await commands.videoPipelineRestart());
}

/** Set the loop mode (Task 3.1). */
export async function setLoop(mode: "none" | "one"): Promise<null> {
  return unwrap(await commands.videoPipelineSetLoop(mode));
}

/**
 * Attach the native GStreamer sink for `windowLabel` so the shared pipeline
 * renders directly into that window's OS surface (Phase 3 of the
 * frame-perfect multi-monitor video plan).
 *
 * Uses an untyped `invoke` because the typed bindings in `bindings.ts` are
 * regenerated by `pnpm tauri dev`; we keep this call working before/after
 * regen so the implementation isn't bound to a single bindings refresh.
 */
export async function attachWindow(windowLabel: string): Promise<void> {
  await invoke("video_pipeline_attach_window", { label: windowLabel });
}

/** Detach the native sink for `windowLabel`. Companion to [`attachWindow`]. */
export async function detachWindow(windowLabel: string): Promise<void> {
  await invoke("video_pipeline_detach_window", { label: windowLabel });
}

/**
 * Phase 5 / Track 1 / Task 4 — surgical recovery from a per-sink GL/D3D11
 * failure. Detaches every currently-attached native sink and re-attaches
 * with a `fakesink` fallback per window. Returns the number of windows
 * that successfully re-attached on the **native** path; windows that
 * fell back to `fakesink` surface via the `videoPipelineSinkDegraded`
 * event.
 *
 * NOT called from anywhere yet — Batch 3 will wire the classifier-driven
 * recovery loop. This wrapper exists so the IPC is reachable from the
 * frontend the moment Batch 3 lands.
 *
 * Uses an untyped `invoke` to stay compatible with the
 * `bindings.ts` regen lifecycle — `pnpm tauri dev` regenerates the typed
 * `commands.videoPipelineRefreshSinks` after this batch is live.
 */
export async function refreshSinks(): Promise<number> {
  const count = await invoke<number>("video_pipeline_refresh_sinks");
  return count;
}
