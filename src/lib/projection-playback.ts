import {
  getAvailableMonitors,
  getMonitorConfigs,
  openProjectorWindow,
  openReturnWindow,
  setCurrentSlide,
  setSlideContext,
} from "./tauri";
import type { MonitorConfig } from "../types/settings";
import { useDisplayStore } from "../stores/display-store";
import { usePresentationStore } from "../stores/presentation-store";
import type { SlideContent } from "../types/presentation";
import { slideContentToFlat } from "../types/presentation";

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

      const monitorIndexById = new Map(monitors.map((monitor, index) => [monitor.id, index] as const));
      const { projectorIndex, returnIndex } = resolveProjectionMonitorIndexes(
        monitorConfigs,
        monitors.length,
        monitorIndexById,
      );

      if (!useDisplayStore.getState().projectorWindowOpen) {
        await openProjectorWindow(projectorIndex);
        useDisplayStore.getState().setProjectorWindowOpen(true);
      }

      if (!useDisplayStore.getState().returnWindowOpen) {
        // Give the first fullscreen transition a moment before opening the second window.
        await sleep(180);
        await openReturnWindow(returnIndex);
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

  await setCurrentSlide(slideContentToFlat(currentSlide));
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

function resolveMonitorIndex(
  configs: MonitorConfig[],
  role: "projector" | "return",
  fallbackIndex: number,
  monitorIndexById: Map<string, number>,
  monitorCount: number,
): number {
  const configIndex = configs
    .find((config) => config.role === role && config.enabled)
    ?.monitor_id;
  const fromConfig = configIndex != null ? monitorIndexById.get(configIndex) : undefined;
  if (fromConfig != null && Number.isFinite(fromConfig)) {
    return fromConfig;
  }

  return Math.max(0, Math.min(fallbackIndex, monitorCount - 1));
}

function resolveProjectionMonitorIndexes(
  configs: MonitorConfig[],
  monitorCount: number,
  monitorIndexById: Map<string, number>,
): { projectorIndex: number; returnIndex: number } {
  const projectorIndex = resolveMonitorIndex(
    configs,
    "projector",
    monitorCount > 1 ? 1 : 0,
    monitorIndexById,
    monitorCount,
  );
  let returnIndex = resolveMonitorIndex(
    configs,
    "return",
    monitorCount > 2 ? 2 : 0,
    monitorIndexById,
    monitorCount,
  );

  // Avoid opening both projection windows on the same monitor when we have alternatives.
  if (monitorCount > 1 && returnIndex === projectorIndex) {
    returnIndex = projectorIndex === 0 ? 1 : 0;
  }

  return { projectorIndex, returnIndex };
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
