import { audioStop, clearCurrentSlide } from "./tauri";
import { useAudioStore } from "../stores/audio-store";

/**
 * Clears the current projection and stops song audio playback when active.
 * Used by explicit projection-stop actions (Escape, palette, stop buttons).
 */
export async function stopProjectionAndSongAudio(): Promise<void> {
  await clearCurrentSlide();

  const audioState = useAudioStore.getState();

  try {
    await audioStop();
  } catch (error) {
    console.warn("Failed to stop audio after projection clear:", error);
  }

  audioState.stopStatusSubscription();
  audioState.setStatus("idle");
  audioState.setPosition(0);
  audioState.setCurrentFile(null);
}
