import { useEffect } from "react";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { matchesShortcutCombo } from "../lib/shortcut-definitions";

interface PlayingNowActions {
  play: () => void;
  pause: () => void;
  prevItem: () => void;
  nextItem: () => void;
}

/**
 * Keyboard shortcuts active only on the /playing-now route.
 * P = play/pause, M = mute/unmute, [ = prev item, ] = next item.
 * Receives stable action callbacks from useMediaPlayer() to reuse
 * its play/pause/prevItem/nextItem logic (including video branch).
 */
export function usePlayingNowKeyboard({ play, pause, prevItem, nextItem }: PlayingNowActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (matchesShortcutCombo(e, "p")) {
        e.preventDefault();
        const status = useMediaPlayerStore.getState().status;
        if (status === "playing") pause();
        else play();
      } else if (matchesShortcutCombo(e, "m")) {
        e.preventDefault();
        const audioState = useAudioStore.getState();
        void audioState.setOutputMuted(!audioState.outputMuted);
      } else if (matchesShortcutCombo(e, "[")) {
        e.preventDefault();
        prevItem();
      } else if (matchesShortcutCombo(e, "]")) {
        e.preventDefault();
        nextItem();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [play, pause, prevItem, nextItem]);
}
