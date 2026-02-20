import {
  getAvailableMonitors,
  getMonitorConfigs,
  openProjectorWindow,
  openReturnWindow,
  setCurrentSlide,
  setSlideContext,
} from "./tauri";
import { useDisplayStore } from "../stores/display-store";
import { usePresentationStore } from "../stores/presentation-store";
import type { SlideContent, SlideContentFlat } from "../types/presentation";
import { slideContentToFlat } from "../types/presentation";
import { resolveProjectionMonitorIndexes } from "./monitor-resolution";

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
    try {
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
    } catch (error) {
      console.warn("Failed to ensure projection windows are open:", error);
    }
  })().finally(() => {
    ensureProjectionPromise = null;
  });

  return ensureProjectionPromise;
}

export async function projectSlideIndex(index: number): Promise<void> {
  const presentationState = usePresentationStore.getState();
  if (index < 0 || index >= presentationState.slides.length) {
    return;
  }

  presentationState.setActiveSlideIndex(index);
  const currentSlide = presentationState.slides[index];
  const nextSlide = index + 1 < presentationState.slides.length
    ? presentationState.slides[index + 1]
    : null;

  // Determine projection type based on context
  const currentPresentationId = presentationState.currentPresentationId;
  const projectionType: "hymn" | "presentation" = currentPresentationId ? "presentation" : "hymn";

  await projectSlideWithType(slideContentToFlat(currentSlide), projectionType);
  await setSlideContext({
    next: nextSlide ? slideContentToFlat(nextSlide) : null,
    index,
    total: presentationState.slides.length,
    title: getSlideTitle(currentSlide),
  });
}

export async function projectCurrentSlideFromStore(): Promise<void> {
  const presentationState = usePresentationStore.getState();
  if (presentationState.slides.length === 0) {
    return;
  }
  const index = Math.max(
    0,
    Math.min(presentationState.activeSlideIndex, presentationState.slides.length - 1),
  );
  await projectSlideIndex(index);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSlideTitle(slide: SlideContent): string {
  switch (slide.type) {
    case "cover":
      return slide.title;
    case "lyrics":
      return slide.label ?? "Lyrics";
    case "bible":
      return `${slide.book} ${slide.chapter}:${slide.verseStart}-${slide.verseEnd}`;
    case "text":
      return slide.text.substring(0, 40);
    case "pause":
      return "Pause";
    case "image":
      return slide.alt ?? "Image";
    case "video":
      return "Video";
  }
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
  slideData: SlideContent | SlideContentFlat,
  projectionType: "bible" | "hymn" | "presentation" | "utility" | "service",
): Promise<void> {
  const flat = slideData instanceof Object && (slideData as any).slide_type
    ? (slideData as SlideContentFlat)
    : slideContentToFlat(slideData as SlideContent);
  
  // If projection is already active, atomically switch content
  // This ensures the new content appears immediately without interruption
  const wasActive = isProjectionActive();
  
  await setCurrentSlide(flat);
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
  const { clearCurrentSlide } = await import("./tauri");
  await clearCurrentSlide();
  useDisplayStore.getState().setCurrentProjectionType(null);
}
