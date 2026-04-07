import { useEffect } from "react";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useAudioStore } from "../stores/audio-store";
import { matchesShortcutCombo } from "../lib/shortcut-definitions";

const VOLUME_STEP = 0.05;

interface PlayingNowActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  restart: () => void;
  prevItem: () => void;
  nextItem: () => void;
  setVolume: (volume: number) => void;
}

/**
 * Keyboard shortcuts active only on the /playing-now route.
 * P = play/pause, S = stop, R = restart, M = mute/unmute,
 * [ = prev item, ] = next item, ArrowUp = volume up, ArrowDown = volume down.
 */
export function usePlayingNowKeyboard({ play, pause, stop, restart, prevItem, nextItem, setVolume }: PlayingNowActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (matchesShortcutCombo(e, "p")) {
        e.preventDefault();
        const status = useMediaPlayerStore.getState().status;
        if (status === "playing") pause();
        else play();
      } else if (matchesShortcutCombo(e, "s")) {
        e.preventDefault();
        stop();
      } else if (matchesShortcutCombo(e, "r")) {
        e.preventDefault();
        restart();
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
      } else if (matchesShortcutCombo(e, "ArrowUp")) {
        e.preventDefault();
        const vol = useAudioStore.getState().volume;
        setVolume(Math.min(1, vol + VOLUME_STEP));
      } else if (matchesShortcutCombo(e, "ArrowDown")) {
        e.preventDefault();
        const vol = useAudioStore.getState().volume;
        setVolume(Math.max(0, vol - VOLUME_STEP));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [play, pause, stop, restart, prevItem, nextItem, setVolume]);
}
