import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { usePresentationStore } from "../stores/presentation-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
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
  const setMediaSlides = useMediaPlayerStore((state) => state.setSlides);
  const setPresentationActiveSlideIndex = usePresentationStore((state) => state.setActiveSlideIndex);
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const setAudioSyncPoints = useAudioStore((state) => state.setSyncPoints);
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
    setMediaSlides(generatedSlides);
    setPresentationActiveSlideIndex(clampedIndex);
    setAudioSyncPoints(effectiveSyncPoints);

    return { generatedSlides, clampedIndex };
  }, [setAudioSyncPoints, setCurrentPresentation, setPresentationActiveSlideIndex, setMediaSlides]);

  const handleStartCantado = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      addToQueue([{ id: crypto.randomUUID(), kind: "hymn", hymn, type: "audio" }], true);
      router.navigate({ to: "/playing-now" });
    }, { notify: false });
  }, [router, addToQueue]);

  const handleStartPlayback = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      addToQueue([{ id: crypto.randomUUID(), kind: "hymn", hymn, type: "playback" }], true);
      router.navigate({ to: "/playing-now" });
    }, { notify: false });
  }, [router, addToQueue]);

  const handleStartSlidesOnly = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      addToQueue([{ id: crypto.randomUUID(), kind: "hymn", hymn, type: "projection" }], true);
      router.navigate({ to: "/playing-now" });
    }, { notify: false });
  }, [router, addToQueue]);

  const handlePlayNext = useCallback((hymn: Hymn, type: "audio" | "playback" | "projection" = "audio") => {
    const queueState = useQueueStore.getState();
    if (queueState.items.length === 0) {
      addToQueue([{ id: crypto.randomUUID(), kind: "hymn", hymn, type }], true);
      router.navigate({ to: "/playing-now" });
      return;
    }
    queueState.addToQueueNext({ id: crypto.randomUUID(), kind: "hymn", hymn, type });
  }, [router, addToQueue]);

  return {
    bindHymnToPlaybackQueue,
    handleStartCantado,
    handleStartPlayback,
    handleStartSlidesOnly,
    handlePlayNext,
  };
}
