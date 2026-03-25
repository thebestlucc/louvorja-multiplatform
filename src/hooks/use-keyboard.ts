import { useCallback, useEffect } from "react";
import { useSlides } from "./use-slides";
import { useMonitorsControl } from "./use-monitors";
import { usePresentationStore } from "../stores/presentation-store";
import { useVideoPlayerStore } from "../stores/video-player-store";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { stopProjectionAndSongAudio } from "../lib/projection-control";
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
    // Do not clear projection via Escape when a video is actively playing —
    // the video has its own stop mechanism in the Playing Now controls.
    const videoState = useVideoPlayerStore.getState();
    const isVideoPlaying = videoState.videoId !== null || videoState.videoSrc !== null;
    if (isVideoPlaying) return;

    usePresentationStore.getState().setSlides([]);
    void stopProjectionAndSongAudio();
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

    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
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
        unlisten = fn;
      });
    });

    return () => {
      unlisten?.();
    };
  }, [enabled, nextSlide, prevSlide, toggleBlackScreen, toggleLogoScreen]);
}
