import { audioStop, clearCurrentSlide } from "./tauri";
import { useAudioStore } from "../stores/audio-store";
import { useDisplayStore } from "../stores/display-store";
import { catcher } from "./catcher";

/**
 * Clears the current projection and stops song audio playback when active.
 * Used by explicit projection-stop actions (Escape, palette, stop buttons).
 */
export async function stopProjectionAndSongAudio(): Promise<void> {
  await clearCurrentSlide();
  useDisplayStore.getState().setCurrentProjectionType(null);

  const audioState = useAudioStore.getState();

  const [_, error] = await catcher(audioStop(), { notify: false });
  if (error) {
    console.warn("Failed to stop audio after projection clear:", error);
  }

  audioState.stopStatusSubscription();
  audioState.setStatus("idle");
  audioState.setPosition(0);
  audioState.setCurrentFile(null);
}
