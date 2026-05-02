// Phase 5 / Track 1 / Task 5 — Centralized classifier for the Rust video
// pipeline's error strings. Mirrors the pattern in `src/lib/update-errors.ts`:
// pattern-match the raw Rust error message into a typed bucket and surface
// pastoral i18n keys for title/why/action so toasts read like a person wrote
// them, not like a stack trace.
//
// 6 buckets:
//   - `state_change_failed` (retryable)  — uridecodebin/sink failed to reach
//     PAUSED. Surfaced as "Não foi possível iniciar o vídeo" with a one-shot
//     auto-retry in `tauri/video-pipeline.ts::load()` BEFORE this toast fires.
//   - `gl_color_convert`                 — return-window GL sink couldn't
//     prepare an output buffer. UI auto-recovers via `videoPipeline.refreshSinks()`
//     in the listener; toast only fires if the recovery itself fails.
//   - `hls_fragment_failed`              — HLS fragment download failed (YouTube
//     adaptive-bitrate stream blip). User can retry; pipeline recovers on retry.
//   - `uri_invalid`                      — yt-dlp failed to resolve a URI or the
//     resolved URI expired. Frontend should re-resolve via fresh yt-dlp call.
//   - `not_found`                        — local media file path missing on disk.
//     Non-recoverable from the pipeline; user must reopen the library.
//   - `generic`                          — fallback for anything we don't
//     pattern-match.
//
// Locale strings live under `videoPipelineErrors.<bucket>.{title,why,action}`
// in `en.json`/`pt.json`/`es.json`. Title/why/action are the only keys — there
// is no `reassurance` analog (those updater-style messages are about user data
// safety; video-pipeline failures don't risk user data).

export type VideoPipelineErrorBucket =
  | "state_change_failed"
  | "gl_color_convert"
  | "hls_fragment_failed"
  | "uri_invalid"
  | "not_found"
  | "generic";

export interface VideoPipelineErrorClassification {
  bucket: VideoPipelineErrorBucket;
  titleKey: string;
  whyKey: string;
  actionKey: string;
  rawMessage: string;
  /** True only for transient failures the auto-retry layer should attempt
   *  to recover silently. Currently only `state_change_failed`. */
  retryable: boolean;
}

// Order matters: the first matching pattern wins. `not_found` and `uri_invalid`
// come before `state_change_failed` because a missing local file or invalid
// URI tends to surface as a state-change failure too — but the more specific
// classification is more useful for the user.
const BUCKET_PATTERNS: Array<[VideoPipelineErrorBucket, RegExp]> = [
  [
    "not_found",
    /not\s*found|no such file|local media file not found/i,
  ],
  [
    "uri_invalid",
    // yt-dlp must be paired with a context word that signals a URI/resolve
    // failure — bare /yt-dlp/ matched transient warnings and the
    // "yt-dlp binary not found" setup error too eagerly.
    /URI inv[aá]lido|URI invalid|No element accepted URI|yt-dlp.*(failed|invalid|expired|resolve|empty|non[-_ ]http)/i,
  ],
  [
    "gl_color_convert",
    /GstGLColorConvertElement|GstGLImageSinkBin|Failed to convert video buffer/i,
  ],
  [
    "hls_fragment_failed",
    /GstHLSDemux|Couldn't download fragments|Fragment downloading has failed/i,
  ],
  [
    "state_change_failed",
    /Element failed to change its state|PAUSED state wait|set_state\(PAUSED\)/i,
  ],
];

const BUCKET_KEYS: Record<
  VideoPipelineErrorBucket,
  { titleKey: string; whyKey: string; actionKey: string; retryable: boolean }
> = {
  state_change_failed: {
    titleKey: "videoPipelineErrors.stateChangeFailed.title",
    whyKey: "videoPipelineErrors.stateChangeFailed.why",
    actionKey: "videoPipelineErrors.stateChangeFailed.action",
    retryable: true,
  },
  gl_color_convert: {
    titleKey: "videoPipelineErrors.glColorConvert.title",
    whyKey: "videoPipelineErrors.glColorConvert.why",
    actionKey: "videoPipelineErrors.glColorConvert.action",
    retryable: false,
  },
  hls_fragment_failed: {
    titleKey: "videoPipelineErrors.hlsFragment.title",
    whyKey: "videoPipelineErrors.hlsFragment.why",
    actionKey: "videoPipelineErrors.hlsFragment.action",
    retryable: false,
  },
  uri_invalid: {
    titleKey: "videoPipelineErrors.uriInvalid.title",
    whyKey: "videoPipelineErrors.uriInvalid.why",
    actionKey: "videoPipelineErrors.uriInvalid.action",
    retryable: false,
  },
  not_found: {
    titleKey: "videoPipelineErrors.notFound.title",
    whyKey: "videoPipelineErrors.notFound.why",
    actionKey: "videoPipelineErrors.notFound.action",
    retryable: false,
  },
  generic: {
    titleKey: "videoPipelineErrors.generic.title",
    whyKey: "videoPipelineErrors.generic.why",
    actionKey: "videoPipelineErrors.generic.action",
    retryable: false,
  },
};

function extractMessage(error: unknown): string {
  if (error === null || error === undefined) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === "string") return maybe.message;
  }
  return String(error);
}

export function classifyVideoPipelineError(
  error: unknown,
): VideoPipelineErrorClassification {
  const rawMessage = extractMessage(error);
  for (const [bucket, pattern] of BUCKET_PATTERNS) {
    if (pattern.test(rawMessage)) {
      const meta = BUCKET_KEYS[bucket];
      return {
        bucket,
        titleKey: meta.titleKey,
        whyKey: meta.whyKey,
        actionKey: meta.actionKey,
        rawMessage,
        retryable: meta.retryable,
      };
    }
  }
  const meta = BUCKET_KEYS.generic;
  return {
    bucket: "generic",
    titleKey: meta.titleKey,
    whyKey: meta.whyKey,
    actionKey: meta.actionKey,
    rawMessage,
    retryable: meta.retryable,
  };
}
