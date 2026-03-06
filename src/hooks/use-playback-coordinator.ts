import { useEffect, useCallback, useRef } from "react";
import { useQueueStore } from "../stores/queue-store";
import { useAudioStore } from "../stores/audio-store";
import { usePresentationStore } from "../stores/presentation-store";
import { useDisplayStore } from "../stores/display-store";
import { getSyncPoints } from "../lib/tauri";
import { catcher } from "../lib/catcher";
import { projectSlideIndex } from "../lib/projection-playback";
import { hymnToSlides } from "./use-hymn-playback";

/**
 * Centralized hook to coordinate playback and projection based on the queue store.
 * This ensures that whenever the queue's current index changes, the audio,
 * slides, and projection are automatically synchronized.
 */
export function usePlaybackCoordinator() {
  const items = useQueueStore((s) => s.items);
  const currentIndex = useQueueStore((s) => s.currentIndex);
  const next = useQueueStore((s) => s.next);

  const setSyncPoints = useAudioStore((s) => s.setSyncPoints);
  const setOnFinished = useAudioStore((s) => s.setOnFinished);
  const setPlaybackMode = useAudioStore((s) => s.setPlaybackMode);
  const playAudio = useAudioStore((s) => s.play);
  const stopAudio = useAudioStore((s) => s.stop);

  const setActiveSlideIndex = usePresentationStore((s) => s.setActiveSlideIndex);
  const setPresentationSlides = usePresentationStore((s) => s.setSlides);
  const setCurrentPresentation = usePresentationStore((s) => s.setCurrentPresentation);

  const lastPlayedIndexRef = useRef<number | null>(null);

  const playItem = useCallback(async (index: number) => {
    const item = items[index];
    if (!item) return;

    // Guard: Don't re-trigger if we've already started this item
    if (lastPlayedIndexRef.current === index) return;
    lastPlayedIndexRef.current = index;

    const hymnId = item.hymn?.id;
    const audioPath = item.type === "projection"
      ? null
      : item.type === "playback"
        ? (item.hymn?.playbackPath || item.hymn?.audioPath)
        : item.hymn?.audioPath; // "audio" = Cantado = sung version

    await catcher(async () => {
      // 1. Fetch sync points if it's a hymn
      if (hymnId) {
        const syncPoints = await getSyncPoints(hymnId);
        setSyncPoints(syncPoints || []);
      } else {
        setSyncPoints([]);
      }

      // 2. Start audio playback if applicable
      if (audioPath) {
        setPlaybackMode(item.type === "playback" ? "karaoke" : "sung");
        await playAudio(audioPath, 0);
      } else {
        setPlaybackMode("silent");
        // If no audio, we might need to stop any current audio
        await stopAudio();
      }

      // 3. Reset to first slide and project it
      if (item.hymn) {
        setCurrentPresentation(null);
        const generatedSlides = hymnToSlides(item.hymn.title, item.hymn.lyrics, item.hymn.album, item.hymn.coverPath);
        setPresentationSlides(generatedSlides);
      }

      useDisplayStore.getState().setCurrentProjectionType("hymn");
      setActiveSlideIndex(0);
      await projectSlideIndex(0);

    }, { notify: true });  }, [items, setSyncPoints, setActiveSlideIndex, setPresentationSlides, setCurrentPresentation, setPlaybackMode, playAudio, stopAudio]);

  // Effect: React to queue index changes
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < items.length) {
      void playItem(currentIndex);
    } else if (currentIndex === -1) {
      lastPlayedIndexRef.current = null;
    }
  }, [currentIndex, items.length, playItem]);

  // Effect: Reset lastPlayedIndexRef when items list changes significantly (e.g. queue cleared/replaced)
  useEffect(() => {
    lastPlayedIndexRef.current = null;
  }, [items]);

  // Effect: Register Auto-Next callback
  useEffect(() => {
    setOnFinished(() => {
      console.log("[playback-coordinator] Audio finished, advancing queue");
      next();
    });
    
    return () => {
      setOnFinished(null);
    };
  }, [setOnFinished, next]);
}
