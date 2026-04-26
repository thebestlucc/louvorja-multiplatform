// src/hooks/use-online-video-bridge.ts
//
// Always-mounted bridge from `slide-changed` events to `useMediaPlayerStore`
// for online-video slides. Runs unconditionally so the playing-now control bar
// keeps working when `PersistentVideoPlayer` is gated off (rust video pipeline
// flag = ON).
//
// Why this exists: `useMediaPlayer` (in playing-now) routes play/pause/seek
// based on `state.timelineSource`. That source is only set to `"video"` when
// `mpStore.load()` is called for an online/offline-video item. Previously the
// bridge was inside `PersistentVideoPlayer.handleSlide`, but that whole
// component is `return null`-ed when `useRustVideoPipeline` is true → bridge
// never fires → `timelineSource` stays `"none"` → every video control silently
// no-ops.
//
// In addition to the `mpStore.load()` bridge, when the rust pipeline flag is
// on we also push the resolved `MediaSource` into the rust video runtime
// (`videoPipeline.load`) so direct projections (VideoCard "Project" buttons,
// liturgy items, slide-driven transitions) end up with a *playing* pipeline
// — not just a populated store. Without this, the projector/return native
// sinks attach to an empty pipeline and the user sees a black screen with
// dead controls.
//
// PersistentVideoPlayer still owns the legacy YouTube iframe / `<video>`
// element lifecycle when the rust pipeline is OFF.
import { useCallback } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { useSlideVersion } from "./use-slide-version";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useVideoPlayerStore } from "../stores/video-player-store";
import * as videoPipeline from "../lib/tauri/video-pipeline";
import type { MediaSource, SlideContent } from "../lib/bindings";
import type { OfflineVideoMediaItem, OnlineVideoMediaItem } from "../types/media";

/**
 * Resolve an `onlineVideo` slide payload to the `MediaSource` shape the rust
 * pipeline expects. Mirrors `playVideoItem` in `use-playback-coordinator.ts`
 * so direct projections (no queue) hit the same code path.
 *
 * Returns `null` when the slide doesn't carry enough information to drive the
 * pipeline (e.g. local source with a relative path that fails to resolve).
 */
async function resolveSlideMediaSource(
  slide: Extract<SlideContent, { slideType: "onlineVideo" }>,
): Promise<MediaSource | null> {
  if (slide.source === "local" && slide.url) {
    // MediaSource::Local needs an absolute path. Managed-media paths
    // (`media/videos/...`) are stored relative to the Tauri app data dir;
    // resolve them on the fly so the rust pipeline can open the file:// URI.
    if (slide.url.startsWith("/")) {
      return { type: "local", absolutePath: slide.url };
    }
    if (slide.url.startsWith("media/")) {
      try {
        const abs = await join(await appDataDir(), slide.url);
        return { type: "local", absolutePath: abs };
      } catch (err) {
        console.error("[online-video-bridge] managed media path resolve failed", err);
        return null;
      }
    }
    return null;
  }
  if (slide.video_id) {
    return { type: "youtube", videoId: slide.video_id };
  }
  return null;
}

/**
 * Mirrors the slide-driven side of `PersistentVideoPlayer.handleSlide`:
 * when an online-video slide becomes active, populate `useMediaPlayerStore`
 * with the matching media item so `timelineSource` flips to `"video"` and
 * the playing-now control bar starts routing actions to the rust pipeline.
 *
 * When `useRustVideoPipeline` is enabled, also calls `videoPipeline.load()`
 * so the rust runtime has an actual source loaded — without this, projector
 * + return native sinks attach to an empty pipeline (black screen, dead
 * controls).
 */
export function useOnlineVideoBridge() {
  const handleSlide = useCallback((slide: SlideContent) => {
    if (slide.slideType !== "onlineVideo") return;

    // Always populate the media-player store. Removed the previous
    // queue-active guard: direct projections (VideoCard project-to-projector,
    // liturgy items, manual slide assignments) bypass the queue but still
    // need the control bar to work. The queue-not-active path is no worse
    // than the queue-active path — both just keep the store in sync with the
    // slide that's already projecting.
    const mpState = useMediaPlayerStore.getState();
    if (slide.source === "local" && slide.url) {
      const item: OfflineVideoMediaItem = {
        type: "offline_video",
        videoPath: slide.url,
        title: slide.title ?? "Video",
        isManaged: slide.url.startsWith("media/"),
      };
      mpState.load(item);
    } else if (slide.video_id) {
      const item: OnlineVideoMediaItem = {
        type: "online_video",
        videoId: slide.video_id,
        videoSource: "youtube",
        title: slide.title ?? "Video",
      };
      mpState.load(item);
    } else {
      // No resolvable source — don't touch the store further.
      return;
    }

    // When the rust pipeline flag is on, also drive the rust runtime so
    // controls + native sinks have something to attach to. Skipped when the
    // flag is off — legacy WebRTC / hidden iframe path owns playback.
    if (!useVideoPlayerStore.getState().useRustVideoPipeline) return;

    resolveSlideMediaSource(slide)
      .then((mediaSource) => {
        if (!mediaSource) {
          console.warn(
            "[online-video-bridge] no resolvable MediaSource for slide",
            slide,
          );
          return;
        }
        videoPipeline
          .load(mediaSource)
          .then(() => {
            // Optimistically reflect playing state so ControlBar enables
            // immediately. The state bridge keeps this in sync from
            // `videoPipelineState` events (~10 Hz).
            useMediaPlayerStore.getState().setStatus("playing");
          })
          .catch((err) => {
            // Backend errors surface via the `video-pipeline-error` event
            // listener (use-rust-video-pipeline-state). Just log here.
            console.error("[online-video-bridge] videoPipeline.load failed", err);
          });
      })
      .catch((err) => {
        console.error("[online-video-bridge] resolveSlideMediaSource failed", err);
      });
  }, []);

  // No onClear: stop/clear is already handled by other layers
  // (`useMediaPlayer.stop()`, `slide-cleared` listener inside `useMediaPlayer`).
  useSlideVersion({ onSlide: handleSlide });
}
