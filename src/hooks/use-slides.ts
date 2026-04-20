import { useCallback } from "react";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { setSlideContext } from "../lib/tauri";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useAudioStore } from "../stores/audio-store";
import { useVideoPlayerStore } from "../stores/video-player-store";
import { catcher } from "../lib/catcher";
import { resolveSlideSeekTimestamp as resolveSlideSeekTimestampForMode } from "../lib/audio-sync";
import { buildProjectionSlideContext } from "../lib/projection-playback";

import type { SlideContent, SyncPoint } from "../lib/bindings";
import type { PlaybackMode } from "../types/audio";
import { projectSlideWithType } from "../lib/projection-playback";

export function useSlides() {
  const slides = useMediaPlayerStore((s) => s.slides);
  const activeSlideIndex = useMediaPlayerStore((s) => s.activeSlideIndex);
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
      const mediaState = useMediaPlayerStore.getState();
      if (index >= 0 && index < mediaState.slides.length) {
        // Only seek audio if explicitly requested (e.g., from Playing now sync-aware navigation).
        // Default: don't seek audio when user clicks a slide/verse in the UI.
        if (options?.seekAudio) {
          await seekAudioToSlideSyncPoint(index);
        }
        mediaState.setActiveSlideIndex(index);
        const slide = mediaState.slides[index];
        const next = index + 1 < mediaState.slides.length ? mediaState.slides[index + 1] : null;
        const title = getSlideTitle(slide);
        await projectSlideWithContext(slide, next, index, mediaState.slides.length, title);
      }
    },
    [projectSlideWithContext, seekAudioToSlideSyncPoint],
  );

  const nextSlide = useCallback(async () => {
    const { activeSlideIndex: idx, slides: currentSlides } = useMediaPlayerStore.getState();

    if (currentSlides.length === 0) return;

    if (idx < currentSlides.length - 1) {
      await goToSlide(idx + 1, { seekAudio: true });
      return;
    }

    // Do not stop projection when a video is currently playing.
    // The video has its own slide type (online_video / video) and the hymn
    // slide list ending should not tear down an unrelated video player.
    const videoState = useVideoPlayerStore.getState();
    const isVideoPlaying = videoState.videoId !== null || videoState.videoSrc !== null;
    if (isVideoPlaying) return;

    await stopProjectionAndSongAudio();
  }, [goToSlide]);

  const prevSlide = useCallback(async () => {
    const { activeSlideIndex: idx } = useMediaPlayerStore.getState();
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
