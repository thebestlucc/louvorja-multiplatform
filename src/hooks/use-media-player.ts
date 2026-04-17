// src/hooks/use-media-player.ts
import { useEffect, useCallback } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { clearCurrentSlide } from "../lib/tauri/display";
import i18next from "i18next";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { usePresentationStore } from "../stores/presentation-store";
import { useQueueStore } from "../stores/queue-store";
import { useDisplayStore } from "../stores/display-store";
import { useSlides } from "./use-slides";
import { resolveSlideSeekTimestamp, resolvePlaybackVariantPaths } from "../lib/audio-sync";
import { resetCoordinatorPlaybackState } from "./use-playback-coordinator";
import type { OverlayState } from "../lib/bindings";

/**
 * Bridges useMediaPlayerStore with Tauri events and side effects.
 * Must be mounted once in the Playing Now route.
 */
export function useMediaPlayer() {
  const store = useMediaPlayerStore;
  const { projectSlideWithContext } = useSlides();

  // --- Subscribe to Tauri events ---

  useEffect(() => {
    let mounted = true;
    const unlisteners: (() => void)[] = [];

    // Note: useAudioStore also listens to audio-status for its own state.
    // This listener updates useMediaPlayerStore separately — both are intentional.
    listen<{ positionMs: number; durationMs: number; isPlaying: boolean }>(
      "audio-status",
      (event) => {
        const state = store.getState();
        if (state.timelineSource !== "audio") return;
        state.updateTimeline(event.payload.positionMs, event.payload.durationMs, "audio");

        if (event.payload.isPlaying && state.status !== "playing") {
          store.getState().setStatus("playing");
        }
      },
    ).then((u) => {
      if (!mounted) u();
      else unlisteners.push(u);
    }).catch(() => {});

    // Video timeline updates
    listen<{ currentTime: number; duration: number; paused: boolean; volume: number }>(
      "video-state",
      (event) => {
        const state = store.getState();
        if (state.timelineSource !== "video") return;
        state.updateTimeline(
          event.payload.currentTime * 1000,
          event.payload.duration * 1000,
          "video",
        );
        if (!event.payload.paused && state.status !== "playing") {
          store.getState().setStatus("playing");
        }
        if (event.payload.paused && state.status === "playing") {
          store.getState().setStatus("paused");
        }
      },
    ).then((u) => {
      if (!mounted) u();
      else unlisteners.push(u);
    }).catch(() => {});

    // Overlay changes
    listen<OverlayState>("overlay-changed", (event) => {
      const overlay = event.payload?.blackScreen
        ? "black"
        : event.payload?.logoScreen
          ? "logo"
          : null;
      store.getState().setOverlay(overlay);
    }).then((u) => {
      if (!mounted) u();
      else unlisteners.push(u);
    }).catch(() => {});

    // Slide cleared
    listen("slide-cleared", () => {
      useMediaPlayerStore.getState().stop();
    }).then((u) => {
      if (!mounted) u();
      else unlisteners.push(u);
    }).catch(() => {});

    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, []);

  // --- Actions with side effects ---

  const play = useCallback(() => {
    const state = store.getState();

    if (state.timelineSource === "audio") {
      const audioState = useAudioStore.getState();
      audioState.resume();
    } else if (state.timelineSource === "video") {
      emit("video-control", { action: "play" }).catch(() => {});
    }
    store.getState().setStatus("playing");
  }, []);

  const pause = useCallback(() => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      useAudioStore.getState().pause();
    } else if (state.timelineSource === "video") {
      emit("video-control", { action: "pause" }).catch(() => {});
    }
    store.getState().setStatus("paused");
  }, []);

  const stop = useCallback(() => {
    resetCoordinatorPlaybackState();
    // Seek video to beginning before clearing screens
    if (store.getState().timelineSource === "video") {
      emit("video-control", { action: "seek", value: 0 }).catch(() => {});
    }
    useAudioStore.getState().stop();
    clearCurrentSlide();
    useDisplayStore.getState().setCurrentProjectionType(null);

    const pStore = usePresentationStore.getState();
    if (pStore.isPlayingLiturgy) {
      pStore.setPlayingLiturgy(false);
      store.getState().unload();
      return;
    }

    store.getState().stop();
    useQueueStore.getState().clearQueue();
    store.getState().unload();
    // Clear presentation-store slides so the playing-now effectiveSlides fallback
    // doesn't display a stale onlineVideo slide thumbnail after the queue is stopped.
    usePresentationStore.getState().setSlides([]);
  }, []);

  const seek = useCallback((timeMs: number) => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      useAudioStore.getState().seek(timeMs);
    } else if (state.timelineSource === "video") {
      emit("video-control", { action: "seek", value: timeMs / 1000 }).catch(() => {});
    }
  }, []);

  const goToSlide = useCallback(
    async (index: number) => {
      const state = store.getState();
      // Fall back to presentation-store slides when media-player-store has none
      const effectiveSlides = state.slides.length > 0
        ? state.slides
        : usePresentationStore.getState().slides;
      if (index < 0 || index >= effectiveSlides.length) return;
      store.getState().setActiveSlideIndex(index);
      // Also sync presentation-store index for the fallback path
      if (state.slides.length === 0) {
        usePresentationStore.getState().setActiveSlideIndex(index);
      }

      const slide = effectiveSlides[index];
      if (!slide) return;
      const nextSlide = index + 1 < effectiveSlides.length ? effectiveSlides[index + 1] : null;
      const title =
        state.currentItem?.type === "hymn"
          ? state.currentItem.hymn.title
          : state.currentItem?.type === "presentation"
            ? i18next.t("playingNow.presentation")
            : "";

      await projectSlideWithContext(slide, nextSlide, index, effectiveSlides.length, title);

      // Seek audio to sync point if applicable
      if (state.currentItem?.type === "hymn" && state.syncPoints.length > 0) {
        const audioState = useAudioStore.getState();
        if (audioState.status === "playing" || audioState.status === "paused") {
          const mode = state.currentItem.mode;
          const timestamp = resolveSlideSeekTimestamp(state.syncPoints, index, mode);
          if (timestamp !== null) {
            audioState.seek(timestamp);
          }
        }
      }
    },
    [projectSlideWithContext],
  );

  const nextSlide = useCallback(async () => {
    const state = store.getState();
    const effectiveSlides = state.slides.length > 0
      ? state.slides
      : usePresentationStore.getState().slides;
    const effectiveIndex = state.slides.length > 0
      ? state.activeSlideIndex
      : usePresentationStore.getState().activeSlideIndex;
    if (effectiveIndex < effectiveSlides.length - 1) {
      await goToSlide(effectiveIndex + 1);
    }
  }, [goToSlide]);

  const prevSlide = useCallback(async () => {
    const state = store.getState();
    const effectiveIndex = state.slides.length > 0
      ? state.activeSlideIndex
      : usePresentationStore.getState().activeSlideIndex;
    if (effectiveIndex > 0) {
      await goToSlide(effectiveIndex - 1);
    }
  }, [goToSlide]);

  const nextItem = useCallback(() => {
    const pStore = usePresentationStore.getState();
    if (pStore.isPlayingLiturgy) {
      if (pStore.activeLiturgyItemIndex < pStore.liturgyItemsCount - 1) {
        pStore.setActiveLiturgyItemIndex(pStore.activeLiturgyItemIndex + 1);
      } else {
        pStore.setPlayingLiturgy(false);
        store.getState().unload();
      }
      return;
    }
    useQueueStore.getState().next();
  }, []);

  const prevItem = useCallback(() => {
    const pStore = usePresentationStore.getState();
    if (pStore.isPlayingLiturgy && pStore.activeLiturgyItemIndex > 0) {
      pStore.setActiveLiturgyItemIndex(pStore.activeLiturgyItemIndex - 1);
      return;
    }
    if (!pStore.isPlayingLiturgy) {
      useQueueStore.getState().prev();
    }
  }, []);

  const switchMode = useCallback(async (mode: "sung" | "karaoke" | "silent") => {
    const state = store.getState();
    if (state.currentItem?.type !== "hymn") return;

    const hymn = state.currentItem.hymn;
    store.getState().setMode(mode);

    if (mode === "silent") {
      // Mute audio but keep it playing so timeline stays in sync
      await useAudioStore.getState().setOutputMuted(true);
      useAudioStore.getState().setPlaybackMode("silent");
      return;
    }

    const prevMode = state.currentItem.mode;
    const variantPaths = resolvePlaybackVariantPaths(hymn.audioPath, hymn.playbackPath);
    const audioState = useAudioStore.getState();

    // Unmute when leaving silent mode
    if (prevMode === "silent" && audioState.outputMuted) {
      await audioState.setOutputMuted(false);
    }

    // Smooth switch between sung/karaoke if variants are available
    if ((mode === "sung" || mode === "karaoke") && variantPaths) {
      const activeFilePath = mode === "karaoke"
        ? variantPaths.karaokePath
        : variantPaths.sungPath;
      await useAudioStore.getState().switchVariant(mode === "karaoke" ? "karaoke" : "sung", activeFilePath);
      useAudioStore.getState().setPlaybackMode(mode === "karaoke" ? "karaoke" : "sung");
      return;
    }

    // Fallback: no variant paths available, restart with single track
    await useAudioStore.getState().stop();

    const audioPath = mode === "karaoke"
      ? (hymn.playbackPath || hymn.audioPath)
      : hymn.audioPath;

    if (audioPath) {
      const playbackMode = mode === "karaoke" ? "karaoke" : "sung";
      useAudioStore.getState().setPlaybackMode(playbackMode);
      await useAudioStore.getState().play(audioPath, state.currentTime);
    }
  }, []);

  const restart = useCallback(() => {
    const state = store.getState();
    if (state.timelineSource === "video") {
      emit("video-control", { action: "pause" }).catch(() => {});
      emit("video-control", { action: "seek", value: 0 }).catch(() => {});
      emit("video-control", { action: "play" }).catch(() => {});
    } else {
      useAudioStore.getState().seek(0);
      useAudioStore.getState().resume();
    }
    useMediaPlayerStore.setState({ currentTime: 0, activeSlideIndex: 0 });
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (store.getState().timelineSource === "video") {
      // Bypass rodio command (no audio player active in video mode)
      useAudioStore.setState({ volume });
      emit("video-control", { action: "volume", value: volume }).catch(() => {});
    } else {
      useAudioStore.getState().setVolume(volume);
    }
  }, []);

  return { play, pause, stop, seek, restart, goToSlide, nextSlide, prevSlide, nextItem, prevItem, switchMode, setVolume };
}
