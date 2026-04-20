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
  prevSlide: () => void;
  nextSlide: () => void;
  prevItem: () => void;
  nextItem: () => void;
  setVolume: (volume: number) => void;
}

/**
 * Extra keyboard shortcuts active only on the /playing-now route.
 * P = play/pause, S = stop, R = restart, M = mute/unmute,
 * Alt+ArrowLeft/[ = prev queue item, Alt+ArrowRight/] = next queue item,
 * ArrowUp = volume up, ArrowDown = volume down.
 *
 * Space (play/pause) and ArrowLeft/Right (prev/next slide) are handled
 * globally in use-keyboard.ts so they work on any route.
 */
export function usePlayingNowKeyboard({ play, pause, stop, restart, prevSlide, nextSlide, prevItem, nextItem, setVolume }: PlayingNowActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (matchesShortcutCombo(e, "p")) {
        e.preventDefault();
        const status = useMediaPlayerStore.getState().status;
        if (status === "playing") pause();
        else play();
      } else if (matchesShortcutCombo(e, "s") || matchesShortcutCombo(e, "Escape")) {
        // Escape on /playing-now mirrors the Stop button — full teardown
        // (queue + media-player + Rust pipeline) instead of the global
        // clearPresentation() which only clears projection.
        e.preventDefault();
        stop();
      } else if (matchesShortcutCombo(e, "r")) {
        e.preventDefault();
        restart();
      } else if (matchesShortcutCombo(e, "m")) {
        e.preventDefault();
        const audioState = useAudioStore.getState();
        audioState.setOutputMuted(!audioState.outputMuted);
      } else if (matchesShortcutCombo(e, "Alt+ArrowLeft") || matchesShortcutCombo(e, "[")) {
        e.preventDefault();
        prevItem();
      } else if (matchesShortcutCombo(e, "Alt+ArrowRight") || matchesShortcutCombo(e, "]")) {
        e.preventDefault();
        nextItem();
      } else if (matchesShortcutCombo(e, "ArrowRight")) {
        e.preventDefault();
        nextSlide();
      } else if (matchesShortcutCombo(e, "ArrowLeft")) {
        e.preventDefault();
        prevSlide();
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
  }, [play, pause, stop, restart, prevSlide, nextSlide, prevItem, nextItem, setVolume]);
}
