import { useCallback } from "react";
import { usePresentationStore } from "../stores/presentation-store";
import { setSlideContext } from "../lib/tauri";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useAudioStore } from "../stores/audio-store";
import { catcher } from "../lib/catcher";
import { resolveSlideSeekTimestamp as resolveSlideSeekTimestampForMode } from "../lib/audio-sync";
import { buildProjectionSlideContext } from "../lib/projection-playback";

import type { SlideContent, SyncPoint } from "../lib/bindings";
import type { PlaybackMode } from "../types/audio";
import { projectSlideWithType } from "../lib/projection-playback";

export function useSlides() {
  const {
    slides,
    activeSlideIndex,
  } = usePresentationStore();
  const currentPresentationId = usePresentationStore((s) => s.currentPresentationId);

  // Determine projection type based on which presentation context we're in
  const getProjectionType = useCallback((): "hymn" | "presentation" | "service" => {
    if (!currentPresentationId) {
      // Hymn projection (from $hymnId route with in-memory slides)
      return "hymn";
    }
    // Presentation or service (from stored presentations)
    return "presentation";
  }, [currentPresentationId]);

  const projectSlide = useCallback(
    async (slide: SlideContent) => {
      const projectionType = getProjectionType();
      await projectSlideWithType(slide, projectionType);
    },
    [getProjectionType],
  );

  const projectSlideWithContext = useCallback(
    async (
      slide: SlideContent,
      next: SlideContent | null,
      index: number,
      total: number,
      title: string,
    ) => {
      const projectionType = getProjectionType();
      await projectSlideWithType(slide, projectionType);
      await setSlideContext(buildProjectionSlideContext(next, index, total, title));
    },
    [getProjectionType],
  );

  const seekAudioToSlideSyncPoint = useCallback(async (index: number) => {
    const audioState = useAudioStore.getState();
    const isAudioActive =
      audioState.status === "playing" ||
      audioState.status === "paused" ||
      audioState.status === "seeking";

    if (!isAudioActive || audioState.syncPoints.length === 0) {
      return;
    }

    const timestampMs = resolveSlideSeekTimestamp(
      audioState.syncPoints,
      index,
      audioState.playbackMode,
    );
    if (timestampMs == null) {
      return;
    }

    const [_, error] = await catcher(
      async () => {
        await audioState.seek(timestampMs);
      },
      { notify: false },
    );

    if (error) {
      console.warn("Failed to seek audio on manual slide navigation:", error);
    }
  }, []);

  const goToSlide = useCallback(
    async (index: number, options?: { seekAudio?: boolean }) => {
      const state = usePresentationStore.getState();
      if (index >= 0 && index < state.slides.length) {
        // Only seek audio if explicitly requested (e.g., from Playing now sync-aware navigation).
        // Default: don't seek audio when user clicks a slide/verse in the UI.
        if (options?.seekAudio) {
          await seekAudioToSlideSyncPoint(index);
        }
        state.setActiveSlideIndex(index);
        const slide = state.slides[index];
        const next = index + 1 < state.slides.length ? state.slides[index + 1] : null;
        const title = getSlideTitle(slide);
        await projectSlideWithContext(slide, next, index, state.slides.length, title);
      }
    },
    [projectSlideWithContext, seekAudioToSlideSyncPoint],
  );

  const nextSlide = useCallback(async () => {
    const { activeSlideIndex: idx, slides: currentSlides } = usePresentationStore.getState();

    if (currentSlides.length === 0) return;

    if (idx < currentSlides.length - 1) {
      await goToSlide(idx + 1, { seekAudio: true });
      return;
    }

    await stopProjectionAndSongAudio();
  }, [goToSlide]);

  const prevSlide = useCallback(async () => {
    const { activeSlideIndex: idx } = usePresentationStore.getState();
    await goToSlide(idx - 1, { seekAudio: true });
  }, [goToSlide]);

  return {
    slides,
    activeSlideIndex,
    currentSlide: slides[activeSlideIndex] ?? null,
    nextSlide,
    prevSlide,
    goToSlide,
    projectSlide,
    projectSlideWithContext,
    seekAudioToSlideSyncPoint,
  };
}

export function resolveSlideSeekTimestamp(
  syncPoints: SyncPoint[],
  slideIndex: number,
  mode: PlaybackMode = "sung",
): number | null {
  return resolveSlideSeekTimestampForMode(syncPoints, slideIndex, mode);
}

/** Extract a display title from a slide for the return monitor */
function getSlideTitle(slide: SlideContent): string {
  switch (slide.slideType) {
    case "cover":
      return slide.title ?? "Cover";
    case "lyrics":
      return slide.label ?? "Lyrics";
    case "bible":
      return `${slide.label ?? "Bible"}`;
    case "text":
      return slide.text?.substring(0, 40) ?? "Text";
    case "pause":
      return "Pause";
    case "image":
      return slide.label ?? "Image";
    case "video":
      return slide.label ?? "Video";
    default:
      return "Slide";
  }
}
