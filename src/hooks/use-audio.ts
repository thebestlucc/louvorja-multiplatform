import { useCallback } from "react";
import { useAudioStore } from "../stores/audio-store";

export function useAudio() {
  const store = useAudioStore();

  const togglePlayPause = useCallback(async () => {
    const { status, pause, resume } = useAudioStore.getState();
    if (status === "playing") {
      await pause();
    } else if (status === "paused") {
      await resume();
    }
  }, []);

  return {
    play: store.play,
    playVariants: store.playVariants,
    switchVariant: store.switchVariant,
    pause: store.pause,
    resume: store.resume,
    stop: store.stop,
    seek: store.seek,
    setVolume: store.setVolume,
    setOutputMuted: store.setOutputMuted,
    togglePlayPause,
    status: store.status,
    currentFile: store.currentFile,
    positionMs: store.positionMs,
    durationMs: store.durationMs,
    volume: store.volume,
    outputMuted: store.outputMuted,
    playbackMode: store.playbackMode,
    setPlaybackMode: store.setPlaybackMode,
    syncPoints: store.syncPoints,
    setSyncPoints: store.setSyncPoints,
  };
}
