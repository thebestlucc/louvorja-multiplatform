import { useCallback, useEffect } from "react";
import { useSlides } from "./use-slides";
import { useMonitorsControl } from "./use-monitors";
import { usePresentationStore } from "../stores/presentation-store";
import { openKeyboardShortcutsPanel } from "../components/utilities/keyboard-shortcuts-panel";
import { clearCurrentSlide } from "../lib/tauri";

export function useKeyboard({ enabled = true }: { enabled?: boolean } = {}) {
  const { nextSlide, prevSlide } = useSlides();
  const { toggleProjector, toggleReturn, toggleBlackScreen, toggleLogoScreen } = useMonitorsControl();

  const clearPresentation = useCallback(() => {
    usePresentationStore.getState().setSlides([]);
    clearCurrentSlide();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "/":
        case "?":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            openKeyboardShortcutsPanel();
          }
          break;
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
  }, [enabled, nextSlide, prevSlide, toggleProjector, toggleReturn, toggleBlackScreen, toggleLogoScreen, clearPresentation]);
}
