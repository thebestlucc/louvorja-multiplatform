import { useCallback } from "react";
import { useAudioStore } from "../stores/audio-store";
import {
  audioPlay,
  audioPause,
  audioResume,
  audioStop,
  audioSeek,
  audioSetVolume,
} from "../lib/tauri";
import {
  ensureProjectionScreensStarted,
  projectCurrentSlideFromStore,
} from "../lib/projection-playback";

export function useAudio() {
  const store = useAudioStore();

  const play = useCallback(
    async (filePath: string) => {
      await ensureProjectionScreensStarted();
      await projectCurrentSlideFromStore();
      store.startStatusSubscription();
      await audioPlay(filePath);
    },
    [store],
  );

  const pause = useCallback(async () => {
    await audioPause();
    store.setStatus("paused");
  }, [store]);

  const resume = useCallback(async () => {
    store.startStatusSubscription();
    await audioResume();
  }, [store]);

  const stop = useCallback(async () => {
    await audioStop();
    store.stopStatusSubscription();
    store.setStatus("idle");
    store.setPosition(0);
  }, [store]);

  const seek = useCallback(
    async (ms: number) => {
      await audioSeek(ms);
    },
    [],
  );

  const setVolume = useCallback(
    async (vol: number) => {
      await audioSetVolume(vol);
      store.setVolume(vol);
    },
    [store],
  );

  const togglePlayPause = useCallback(async () => {
    if (store.status === "playing") {
      await pause();
    } else if (store.status === "paused") {
      await resume();
    }
  }, [store.status, pause, resume]);

  return {
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    togglePlayPause,
    status: store.status,
    currentFile: store.currentFile,
    positionMs: store.positionMs,
    durationMs: store.durationMs,
    volume: store.volume,
    playbackMode: store.playbackMode,
    setPlaybackMode: store.setPlaybackMode,
    syncPoints: store.syncPoints,
    setSyncPoints: store.setSyncPoints,
  };
}
