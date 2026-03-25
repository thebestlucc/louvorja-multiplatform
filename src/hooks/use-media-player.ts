// src/hooks/use-media-player.ts
import { useEffect, useCallback } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { useQueueStore } from "../stores/queue-store";
import { useSlides } from "./use-slides";
import { resolveSlideSeekTimestamp } from "../lib/audio-sync";
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
    const unlisteners: (() => void)[] = [];

    // Audio timeline updates
    const unAudio = listen<{ positionMs: number; durationMs: number; isPlaying: boolean }>(
      "audio-status",
      (event) => {
        const state = store.getState();
        if (state.timelineSource !== "audio") return;
        state.updateTimeline(event.payload.positionMs, event.payload.durationMs, "audio");

        if (event.payload.isPlaying && state.status !== "playing") {
          store.getState().setStatus("playing");
        }
      },
    );
    unAudio.then((u) => unlisteners.push(u));

    // Video timeline updates
    const unVideo = listen<{ currentTime: number; duration: number; paused: boolean }>(
      "media-state",
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
    );
    unVideo.then((u) => unlisteners.push(u));

    // Overlay changes
    const unOverlay = listen<OverlayState>("overlay-changed", (event) => {
      const overlay = event.payload?.blackScreen
        ? "black"
        : event.payload?.logoScreen
          ? "logo"
          : null;
      store.getState().setOverlay(overlay);
    });
    unOverlay.then((u) => unlisteners.push(u));

    // Slide cleared
    const unCleared = listen("slide-cleared", () => {});
    unCleared.then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, []);

  // --- Actions with side effects ---

  const play = useCallback(() => {
    const state = store.getState();

    if (state.timelineSource === "audio") {
      const audioState = useAudioStore.getState();
      void audioState.resume();
    } else if (state.timelineSource === "video") {
      void emit("video-control", { action: "play" });
    }
    store.getState().setStatus("playing");
  }, []);

  const pause = useCallback(() => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      void useAudioStore.getState().pause();
    } else if (state.timelineSource === "video") {
      void emit("video-control", { action: "pause" });
    }
    store.getState().setStatus("paused");
  }, []);

  const stop = useCallback(() => {
    void useAudioStore.getState().stop();
    void emit("video-control", { action: "stop" });
    store.getState().stop();
  }, []);

  const seek = useCallback((timeMs: number) => {
    const state = store.getState();
    if (state.timelineSource === "audio") {
      void useAudioStore.getState().seek(timeMs);
    } else if (state.timelineSource === "video") {
      void emit("video-control", { action: "seek", value: timeMs / 1000 });
    }
  }, []);

  const goToSlide = useCallback(
    async (index: number) => {
      const state = store.getState();
      if (index < 0 || index >= state.slides.length) return;
      store.getState().setActiveSlideIndex(index);

      const slide = state.slides[index];
      if (!slide) return;
      const nextSlide = index + 1 < state.slides.length ? state.slides[index + 1] : null;
      const title =
        state.currentItem?.type === "hymn"
          ? state.currentItem.hymn.title
          : state.currentItem?.type === "presentation"
            ? "Presentation"
            : "";

      await projectSlideWithContext(slide, nextSlide, index, state.slides.length, title);

      // Seek audio to sync point if applicable
      if (state.currentItem?.type === "hymn" && state.syncPoints.length > 0) {
        const audioState = useAudioStore.getState();
        if (audioState.status === "playing" || audioState.status === "paused") {
          const mode = state.currentItem.mode;
          const timestamp = resolveSlideSeekTimestamp(state.syncPoints, index, mode);
          if (timestamp !== null) {
            void audioState.seek(timestamp);
          }
        }
      }
    },
    [projectSlideWithContext],
  );

  const nextSlide = useCallback(async () => {
    const state = store.getState();
    if (state.activeSlideIndex < state.slides.length - 1) {
      await goToSlide(state.activeSlideIndex + 1);
    }
  }, [goToSlide]);

  const prevSlide = useCallback(async () => {
    const state = store.getState();
    if (state.activeSlideIndex > 0) {
      await goToSlide(state.activeSlideIndex - 1);
    }
  }, [goToSlide]);

  const nextItem = useCallback(() => {
    useQueueStore.getState().next();
  }, []);

  const prevItem = useCallback(() => {
    useQueueStore.getState().prev();
  }, []);

  return { play, pause, stop, seek, goToSlide, nextSlide, prevSlide, nextItem, prevItem };
}
