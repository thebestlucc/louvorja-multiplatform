import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { usePresentationStore } from "../stores/presentation-store";
import { useAudioStore } from "../stores/audio-store";
import { useQueueStore } from "../stores/queue-store";
import { getSyncPoints as fetchSyncPoints } from "../lib/tauri";
import { catcher } from "../lib/catcher";
import { parseLyricsSyncToPoints } from "../lib/audio-sync";
import type { Hymn, SlideContent } from "../lib/bindings";
import { buildHymnSlides } from "../lib/hymn-slides";

export function hymnToSlides(
  title: string,
  lyrics: string | null,
  album: string | null,
  coverPath?: string | null,
  lyricsSync?: string | null,
): SlideContent[] {
  return buildHymnSlides({
    title,
    lyrics,
    album,
    coverPath,
    lyricsSync,
  });
}

export function useHymnPlayback() {
  const router = useRouter();
  const setPresentationSlides = usePresentationStore((state) => state.setSlides);
  const setPresentationActiveSlideIndex = usePresentationStore((state) => state.setActiveSlideIndex);
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const setAudioSyncPoints = useAudioStore((state) => state.setSyncPoints);
  const clearQueue = useQueueStore((state) => state.clearQueue);
  const addToQueue = useQueueStore((state) => state.addToQueue);

  const bindHymnToPlaybackQueue = useCallback(async (hymn: Hymn, startIndex: number = 0) => {
    const generatedSlides = hymnToSlides(
      hymn.title,
      hymn.lyrics,
      hymn.album,
      hymn.coverPath,
      hymn.lyricsSync,
    );
    if (generatedSlides.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(startIndex, generatedSlides.length - 1));
    const [points] = await catcher(fetchSyncPoints(hymn.id), { notify: false });
    const effectiveSyncPoints = (points && points.length > 0)
      ? points
      : parseLyricsSyncToPoints(hymn.lyricsSync);

    setCurrentPresentation(null);
    setPresentationSlides(generatedSlides);
    setPresentationActiveSlideIndex(clampedIndex);
    setAudioSyncPoints(effectiveSyncPoints);

    return { generatedSlides, clampedIndex };
  }, [setAudioSyncPoints, setCurrentPresentation, setPresentationActiveSlideIndex, setPresentationSlides]);

  const handleStartCantado = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      clearQueue();
      addToQueue([{ id: crypto.randomUUID(), hymn, type: "audio" }], true);
      void router.navigate({ to: "/playing-now" });
    }, { notify: false });
  }, [router, clearQueue, addToQueue]);

  const handleStartPlayback = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      clearQueue();
      addToQueue([{ id: crypto.randomUUID(), hymn, type: "playback" }], true);
      void router.navigate({ to: "/playing-now" });
    }, { notify: false });
  }, [router, clearQueue, addToQueue]);

  const handleStartSlidesOnly = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      clearQueue();
      addToQueue([{ id: crypto.randomUUID(), hymn, type: "projection" }], true);
      void router.navigate({ to: "/playing-now" });
    }, { notify: false });
  }, [router, clearQueue, addToQueue]);

  return {
    bindHymnToPlaybackQueue,
    handleStartCantado,
    handleStartPlayback,
    handleStartSlidesOnly,
  };
}
