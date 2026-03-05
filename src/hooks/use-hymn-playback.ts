import { useCallback } from "react";
import { usePresentationStore } from "../stores/presentation-store";
import { useAudioStore } from "../stores/audio-store";
import { useSlides } from "./use-slides";
import { useAudio } from "./use-audio";
import { getSyncPoints as fetchSyncPoints } from "../lib/tauri";
import { catcher } from "../lib/catcher";
import type { Hymn, SlideContent } from "../lib/bindings";

export function hymnToSlides(title: string, lyrics: string | null, album: string | null, coverPath?: string | null): SlideContent[] {
  const slides: SlideContent[] = [];

  // Cover slide
  slides.push({
    slideType: "cover",
    title,
    subtitle: album ?? null,
    backgroundImage: coverPath ?? null,
    text: null,
    label: null,
    videoPath: null,
    backgroundColor: null,
    audioPath: null,
    autoPlay: null,
    loop: null,
    muted: null,
    mode: null,
    textColor: null,
    textSize: null,
  });

  if (lyrics) {
    const stanzas = lyrics.split("\n\n").filter((s) => s.trim().length > 0);
    stanzas.forEach((stanza, i) => {
      slides.push({
        slideType: "lyrics",
        text: stanza.trim(),
        label: `${i + 1}/${stanzas.length}`,
        backgroundImage: coverPath ?? null,
        title: null,
        subtitle: null,
        videoPath: null,
        backgroundColor: null,
        audioPath: null,
        autoPlay: null,
        loop: null,
        muted: null,
        mode: null,
        textColor: null,
        textSize: null,
      });
    });
  }

  // End pause slide
  slides.push({
    slideType: "pause",
    text: null,
    title: null,
    subtitle: null,
    label: null,
    videoPath: null,
    backgroundImage: null,
    backgroundColor: null,
    audioPath: null,
    autoPlay: null,
    loop: null,
    muted: null,
    mode: null,
    textColor: null,
    textSize: null,
  });

  return slides;
}

export function useHymnPlayback() {
  const setPresentationSlides = usePresentationStore((state) => state.setSlides);
  const setPresentationActiveSlideIndex = usePresentationStore((state) => state.setActiveSlideIndex);
  const setCurrentPresentation = usePresentationStore((state) => state.setCurrentPresentation);
  const setAudioSyncPoints = useAudioStore((state) => state.setSyncPoints);
  const { goToSlide } = useSlides();
  const { play, setPlaybackMode } = useAudio();

  const bindHymnToPlaybackQueue = useCallback(async (hymn: Hymn, startIndex: number = 0) => {
    const generatedSlides = hymnToSlides(hymn.title, hymn.lyrics, hymn.album, hymn.coverPath);
    if (generatedSlides.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(startIndex, generatedSlides.length - 1));
    const [points] = await catcher(fetchSyncPoints(hymn.id), { notify: false });

    setCurrentPresentation(null);
    setPresentationSlides(generatedSlides);
    setPresentationActiveSlideIndex(clampedIndex);
    setAudioSyncPoints(points ?? []);

    return { generatedSlides, clampedIndex };
  }, [setAudioSyncPoints, setCurrentPresentation, setPresentationActiveSlideIndex, setPresentationSlides]);

  const handleStartCantado = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      setPlaybackMode("sung");
      await bindHymnToPlaybackQueue(hymn, 0);
      await goToSlide(0);
      if (hymn.audioPath) await play(hymn.audioPath);
    }, { notify: false });
  }, [bindHymnToPlaybackQueue, goToSlide, play, setPlaybackMode]);

  const handleStartPlayback = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      setPlaybackMode("karaoke");
      await bindHymnToPlaybackQueue(hymn, 0);
      await goToSlide(0);
      const audioPath = hymn.playbackPath || hymn.audioPath;
      if (audioPath) await play(audioPath);
    }, { notify: false });
  }, [bindHymnToPlaybackQueue, goToSlide, play, setPlaybackMode]);

  const handleStartSlidesOnly = useCallback(async (hymn: Hymn) => {
    await catcher(async () => {
      setPlaybackMode("silent");
      await bindHymnToPlaybackQueue(hymn, 0);
      await goToSlide(0);
    }, { notify: false });
  }, [bindHymnToPlaybackQueue, goToSlide, setPlaybackMode]);

  return {
    bindHymnToPlaybackQueue,
    handleStartCantado,
    handleStartPlayback,
    handleStartSlidesOnly,
  };
}
