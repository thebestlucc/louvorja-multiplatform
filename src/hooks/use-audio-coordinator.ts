// src/hooks/use-audio-coordinator.ts
// Subscribes to audio domain events and drives presentation / media-player
// stores. Mounted once in __root.tsx to eliminate direct cross-store calls
// from audio-store.ts.
import { useEffect } from "react";
import { appEventBus } from "../lib/event-bus";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useDisplayStore } from "../stores/display-store";

export function useAudioCoordinator() {
  useEffect(() => {
    // Handle slide sync: audio position changed → update active slide index in both stores
    const unsubSync = appEventBus.on("audio:slide-sync", ({ slideIndex }) => {
      usePresentationStore.getState().setActiveSlideIndex(slideIndex);
      useMediaPlayerStore.getState().setActiveSlideIndex(slideIndex);
    });

    // Handle projection type query: audio-store needs currentProjectionType synchronously
    const unsubQuery = appEventBus.on("audio:query-projection-type", () => {
      const projectionType = useDisplayStore.getState().currentProjectionType;
      appEventBus.emit("audio:projection-type-response", { projectionType });
    });

    return () => {
      unsubSync();
      unsubQuery();
    };
  }, []);
}
