import { useEffect, useCallback } from "react";
import { useQueueStore } from "../stores/queue-store";
import { useAudioStore } from "../stores/audio-store";
import { useDisplayStore } from "../stores/display-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { resolvePlaybackVariantPaths, parseLyricsSyncToPoints } from "../lib/audio-sync";
import { getSyncPoints } from "../lib/tauri";
import { catcher } from "../lib/catcher";
import { projectSlideIndex } from "../lib/projection-playback";
import { hymnToSlides } from "./use-hymn-playback";
import type { HymnMediaItem } from "../types/media";
import type { QueueItem } from "../stores/queue-store";

// Module-level state — survives component remounts so we can distinguish
// "remount with same queue" from "new content queued".
let _lastPlayedIndex: number | null = null;
let _lastItemsRef: QueueItem[] | null = null;

/**
 * Reset coordinator tracking. Called by clearActivePlayback() so that
 * after external content (bible, presentation, video) takes over,
 * the coordinator can re-start playback if the user returns to the queue.
 */
export function resetCoordinatorPlaybackState() {
  _lastPlayedIndex = null;
  _lastItemsRef = null;
}


/**
 * Centralized hook to coordinate playback and projection based on the queue store.
 * This ensures that whenever the queue's current index changes, the audio,
 * slides, and projection are automatically synchronized.
 */
export function usePlaybackCoordinator() {
  const items = useQueueStore((s) => s.items);
  const currentIndex = useQueueStore((s) => s.currentIndex);
  const next = useQueueStore((s) => s.next);

  const setOnFinished = useAudioStore((s) => s.setOnFinished);
  const setPlaybackMode = useAudioStore((s) => s.setPlaybackMode);
  const setSyncPoints = useAudioStore((s) => s.setSyncPoints);
  const playAudio = useAudioStore((s) => s.play);
  const playAudioVariants = useAudioStore((s) => s.playVariants);
  const stopAudio = useAudioStore((s) => s.stop);

  const playItem = useCallback(async (index: number) => {
    const item = items[index];
    if (!item) return;

    // When items array reference changes (new queue), reset tracking
    if (_lastItemsRef !== items) {
      _lastPlayedIndex = null;
      _lastItemsRef = items;
    }

    // Already started this exact item in this queue — skip (handles remount)
    if (_lastPlayedIndex === index) return;

    _lastPlayedIndex = index;

    const hymnId = item.hymn?.id;
    const variantPaths = resolvePlaybackVariantPaths(
      item.hymn?.audioPath,
      item.hymn?.playbackPath,
    );
    const audioPath = item.type === "projection"
      ? null
      : item.type === "playback"
        ? (item.hymn?.playbackPath || item.hymn?.audioPath)
        : item.hymn?.audioPath; // "audio" = Cantado = sung version

    await catcher(async () => {
      // 0. Stop any active video playback from previous content
      const { useVideoPlayerStore } = await import("../stores/video-player-store");
      const videoState = useVideoPlayerStore.getState();
      if (videoState.videoId || videoState.videoSrc) {
        videoState.resetVideoState();
      }

      // 1. Resolve sync points
      let effectiveSyncPoints: import("../lib/bindings").SyncPoint[] = [];
      if (hymnId) {
        const syncPoints = await getSyncPoints(hymnId);
        effectiveSyncPoints = (syncPoints && syncPoints.length > 0)
          ? syncPoints
          : parseLyricsSyncToPoints(item.hymn?.lyricsSync);
      }

      // 2. Build slides
      const slides = item.hymn
        ? hymnToSlides(
            item.hymn.title,
            item.hymn.lyrics,
            item.hymn.album,
            item.hymn.coverPath,
            item.hymn.lyricsSync,
          )
        : [];

      // 3. Map queue type → media mode
      const mode: HymnMediaItem["mode"] =
        item.type === "playback" ? "karaoke"
        : item.type === "projection" ? "silent"
        : "sung";

      // 4. Construct HymnMediaItem and dispatch to media-player-store
      if (item.hymn) {
        const mediaItem: HymnMediaItem = {
          type: "hymn",
          hymn: item.hymn,
          mode,
          slides,
          syncPoints: effectiveSyncPoints,
          audioPath: item.hymn.audioPath ?? undefined,
          playbackPath: item.hymn.playbackPath ?? undefined,
        };
        useMediaPlayerStore.getState().load(mediaItem);
      }

      // 5. Push sync points to audio store so the sync loop can auto-advance slides
      setSyncPoints(effectiveSyncPoints);

      // 6. Start audio playback (rodio lifecycle stays here)
      if (audioPath) {
        const activeMode = item.type === "playback" ? "karaoke" : "sung";
        setPlaybackMode(activeMode);
        if (variantPaths) {
          await playAudioVariants(
            variantPaths.sungPath,
            variantPaths.karaokePath,
            activeMode,
            0,
          );
        } else {
          await playAudio(audioPath, 0);
        }
      } else {
        setPlaybackMode("silent");
        await stopAudio();
      }

      // 7. Project first slide
      useDisplayStore.getState().setCurrentProjectionType("hymn");
      await projectSlideIndex(0);

    }, { notify: true });  }, [items, setSyncPoints, setPlaybackMode, playAudio, playAudioVariants, stopAudio]);

  // Effect: React to queue index changes
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < items.length) {
      void playItem(currentIndex);
    } else if (currentIndex === -1) {
      _lastPlayedIndex = null;
    }
  }, [currentIndex, items.length, playItem]);

  // Effect: Register Auto-Next callback
  useEffect(() => {
    setOnFinished(() => {
      next();
    });

    return () => {
      setOnFinished(null);
    };
  }, [setOnFinished, next]);
}
