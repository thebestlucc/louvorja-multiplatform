import { useEffect } from "react";
import { useSlides } from "./use-slides";
import { useMonitorsControl } from "./use-monitors";
import { setCurrentSlide } from "../lib/tauri";

export function useKeyboard() {
  const { nextSlide, prevSlide } = useSlides();
  const { toggleProjector, isProjectorOpen } = useMonitorsControl();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
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
          // Project black screen
          setCurrentSlide({ slide_type: "pause" });
          break;
        case "F5":
          e.preventDefault();
          toggleProjector();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, toggleProjector, isProjectorOpen]);
}
