import {
  clearCurrentSlide,
  getAvailableMonitors,
  getMonitorConfigs,
  openProjectorWindow,
  openReturnWindow,
  setCurrentSlide,
  setSlideContext,
} from "./tauri";
import { useDisplayStore } from "../stores/display-store";
import { useAudioStore } from "../stores/audio-store";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { catcher } from "./catcher";
import type { SlideContent, SlideContext } from "./bindings";
import { resolveSlideTimingWindow } from "./audio-sync";
import { resolveProjectionMonitorIndexes } from "./monitor-resolution";

/**
 * Stop any active playback (audio + video) and reset coordinator tracking.
 * Call this before starting new projected content so the previous
 * content (hymn, video, etc.) is cleanly released.
 * Type-agnostic: every new content source calls this before projecting.
 */
export async function clearActivePlayback(): Promise<void> {
  // Reset coordinator tracking (dynamic import avoids circular dep)
  const { resetCoordinatorPlaybackState } = await import("../hooks/use-playback-coordinator");
  resetCoordinatorPlaybackState();

  // Stop rodio audio and reset sync state
  const audioState = useAudioStore.getState();
  if (audioState.status !== "idle") {
    await catcher(audioState.stop(), { notify: false });
  }
  audioState.setSyncPoints([]);

  // Stop video playback
  const { useVideoPlayerStore } = await import("../stores/video-player-store");
  const videoState = useVideoPlayerStore.getState();
  if (videoState.videoId || videoState.videoSrc) {
    videoState.resetVideoState();
  }
}

let ensureProjectionPromise: Promise<void> | null = null;

export async function ensureProjectionScreensStarted(): Promise<void> {
  const displayState = useDisplayStore.getState();
  if (displayState.projectorWindowOpen && displayState.returnWindowOpen) {
    return;
  }

  if (ensureProjectionPromise) {
    return ensureProjectionPromise;
  }

  ensureProjectionPromise = (async () => {
    const [_, error] = await catcher(async () => {
      const [monitors, monitorConfigs] = await Promise.all([
        getAvailableMonitors(),
        getMonitorConfigs(),
      ]);

      if (monitors.length === 0) {
        return;
      }

      const resolvedIndexes = resolveProjectionMonitorIndexes(monitors, monitorConfigs);
      if (!resolvedIndexes) {
        return;
      }
      const { projectorIndex, returnIndex } = resolvedIndexes;
      const projectorMonitor = monitors[projectorIndex];
      const returnMonitor = monitors[returnIndex];
      if (!projectorMonitor || !returnMonitor) {
        return;
      }

      if (!useDisplayStore.getState().projectorWindowOpen) {
        await openProjectorWindow(projectorMonitor.id);
        useDisplayStore.getState().setProjectorWindowOpen(true);
      }

      if (!useDisplayStore.getState().returnWindowOpen) {
        // Give the first fullscreen transition a moment before opening the second window.
        await sleep(180);
        await openReturnWindow(returnMonitor.id);
        useDisplayStore.getState().setReturnWindowOpen(true);
      }
    }, { notify: false });

    if (error) {
      console.warn("Failed to ensure projection windows are open:", error);
    }
  })().finally(() => {
    ensureProjectionPromise = null;
  });

  return ensureProjectionPromise;
}

export async function projectSlideIndex(index: number): Promise<void> {
  const presentationState = usePresentationStore.getState();
  const mediaPlayerState = useMediaPlayerStore.getState();
  const slides = mediaPlayerState.slides;

  if (index < 0 || index >= slides.length) {
    return;
  }

  mediaPlayerState.setActiveSlideIndex(index);

  const currentSlide = slides[index];
  const nextSlide = index + 1 < slides.length ? slides[index + 1] : null;

  // Determine projection type based on context
  const currentPresentationId = presentationState.currentPresentationId;
  const projectionType: "hymn" | "presentation" = currentPresentationId ? "presentation" : "hymn";

  await projectSlideWithType(currentSlide, projectionType);
  await setSlideContext(
    buildProjectionSlideContext(
      nextSlide,
      index,
      slides.length,
      getSlideTitle(currentSlide),
    ),
  );
}

export async function projectCurrentSlideFromStore(): Promise<void> {
  const mediaPlayerState = useMediaPlayerStore.getState();
  const slides = mediaPlayerState.slides;
  const activeIndex = mediaPlayerState.activeSlideIndex;

  if (slides.length === 0) {
    return;
  }
  const index = Math.max(0, Math.min(activeIndex, slides.length - 1));
  await projectSlideIndex(index);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSlideTitle(slide: SlideContent): string {
  switch (slide.slideType) {
    case "cover":
      return slide.title ?? "Cover";
    case "lyrics":
      return slide.label ?? "Lyrics";
    case "bible":
      return slide.reference?.substring(0, 40) ?? "Bible";
    case "text":
      return slide.content?.substring(0, 40) ?? "Text";
    case "pause":
      return "Pause";
    case "image":
      return slide.caption ?? "Image";
    case "video":
      return slide.overlay_text ?? "Video";
    default:
      return "Slide";
  }
}

export function buildProjectionSlideContext(
  next: SlideContent | null,
  index: number,
  total: number,
  title: string,
): SlideContext {
  const audioState = useAudioStore.getState();
  const hasPlaybackTiming =
    usePresentationStore.getState().currentPresentationId == null
    && audioState.currentFile != null
    && audioState.syncPoints.length > 0;
  const timingWindow = hasPlaybackTiming
    ? resolveSlideTimingWindow(
      audioState.syncPoints,
      index,
      audioState.playbackMode,
    )
    : { startMs: null, endMs: null };

  return {
    next,
    index,
    total,
    title,
    currentSlideStartMs: timingWindow.startMs,
    nextSlideStartMs: timingWindow.endMs,
    audioDurationMs: audioState.durationMs > 0 ? audioState.durationMs : null,
  };
}

/**
 * Check if projection is currently active (windows open and type is set)
 */
function isProjectionActive(): boolean {
  const displayState = useDisplayStore.getState();
  return displayState.currentProjectionType !== null &&
    (displayState.projectorWindowOpen || displayState.returnWindowOpen);
}

/**
 * Project a slide and update the projection type based on slide content type
 * When projection is already active, this atomically switches to new content
 * while keeping the windows open.
 */
export async function projectSlideWithType(
  slideData: SlideContent,
  projectionType: "bible" | "hymn" | "presentation" | "utility" | "service",
): Promise<void> {
  // If projection is already active, atomically switch content
  // This ensures the new content appears immediately without interruption
  const wasActive = isProjectionActive();
  
  if (useDisplayStore.getState().isFrozen) return;
  await setCurrentSlide(slideData);
  useDisplayStore.getState().setCurrentProjectionType(projectionType);
  
  // Log content switch in active projection for debugging
  if (wasActive) {
    console.debug(`[projection] switched content to ${projectionType}`);
  }
}

/**
 * Clear the current slide and reset projection type
 */
export async function clearProjectionWithType(): Promise<void> {
  await clearCurrentSlide();
  useDisplayStore.getState().setCurrentProjectionType(null);
}
