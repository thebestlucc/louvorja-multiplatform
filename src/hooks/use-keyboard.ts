import { useCallback, useEffect } from "react";
import { useSlides } from "./use-slides";
import { useMonitorsControl } from "./use-monitors";
import { usePresentationStore } from "../stores/presentation-store";
import { useQueueStore } from "../stores/queue-store";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { useSetting } from "../lib/queries";
import { matchesShortcutCombo, normalizeShortcutCombo } from "../lib/shortcut-definitions";
import { spotlightOpen } from "../lib/tauri";

export function useKeyboard({ enabled = true }: { enabled?: boolean } = {}) {
  const { nextSlide, prevSlide } = useSlides();
  const { toggleProjector, toggleReturn, toggleBlackScreen, toggleLogoScreen } = useMonitorsControl();
  const { data: spotlightShortcutSetting } = useSetting("shortcut.app-command-palette.local");
  const { data: shortcutsHelpSetting } = useSetting("shortcut.app-shortcuts-help.local");
  const spotlightLocalCombo = normalizeShortcutCombo(
    spotlightShortcutSetting?.value ?? "Meta+k",
    "local",
  );
  const shortcutsHelpLocalCombo = normalizeShortcutCombo(
    shortcutsHelpSetting?.value ?? "Meta+/",
    "local",
  );

  const clearPresentation = useCallback(() => {
    usePresentationStore.getState().setSlides([]);
    void stopProjectionAndSongAudio();
    // Clear queue when ESC is pressed with one item or at the last item
    const q = useQueueStore.getState();
    if (q.items.length <= 1 || q.currentIndex >= q.items.length - 1) {
      q.clearQueue();
      useMediaPlayerStore.getState().unload();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcutCombo(e, spotlightLocalCombo)) {
        e.preventDefault();
        void spotlightOpen();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isBibleRoute = window.location.pathname.startsWith("/bible");
      if (
        isBibleRoute &&
        (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "PageDown" || e.key === "PageUp" || e.key === " ")
      ) {
        return;
      }

      // On /playing-now, Space/ArrowLeft/ArrowRight are handled by usePlayingNowKeyboard
      const isPlayingNowRoute = window.location.pathname.startsWith("/playing-now");
      if (isPlayingNowRoute && (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        return;
      }

      if (matchesShortcutCombo(e, shortcutsHelpLocalCombo)) {
        e.preventDefault();
        openKeyboardShortcutsPanel();
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prevSlide();
          break;
        case "Escape":
          e.preventDefault();
          clearPresentation();
          break;
        case "F5":
          e.preventDefault();
          if (e.shiftKey) {
            toggleReturn();
          } else {
            toggleProjector();
          }
          break;
        case "b":
        case "B":
          e.preventDefault();
          toggleBlackScreen();
          break;
        case "l":
        case "L":
          e.preventDefault();
          toggleLogoScreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    nextSlide,
    prevSlide,
    toggleProjector,
    toggleReturn,
    toggleBlackScreen,
    toggleLogoScreen,
    clearPresentation,
    spotlightLocalCombo,
    shortcutsHelpLocalCombo,
  ]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen<string>("global-shortcut", (event) => {
        switch (event.payload) {
          case "slides-next":
            nextSlide();
            break;
          case "slides-prev":
            prevSlide();
            break;
          case "display-black":
            toggleBlackScreen();
            break;
          case "display-logo":
            toggleLogoScreen();
            break;
          case "app-shortcuts-help":
            openKeyboardShortcutsPanel();
            break;
        }
      }).then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enabled, nextSlide, prevSlide, toggleBlackScreen, toggleLogoScreen, openKeyboardShortcutsPanel]);
}
