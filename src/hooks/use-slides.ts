import { useCallback } from "react";
import { usePresentationStore } from "../stores/presentation-store";
import { setCurrentSlide } from "../lib/tauri";
import type { SlideContent } from "../types/presentation";
import { slideContentToFlat } from "../types/presentation";

export function useSlides() {
  const {
    slides,
    activeSlideIndex,
    setActiveSlideIndex,
  } = usePresentationStore();

  const projectSlide = useCallback(
    async (slide: SlideContent) => {
      await setCurrentSlide(slideContentToFlat(slide));
    },
    [],
  );

  const goToSlide = useCallback(
    async (index: number) => {
      if (index >= 0 && index < slides.length) {
        setActiveSlideIndex(index);
        await projectSlide(slides[index]);
      }
    },
    [slides, setActiveSlideIndex, projectSlide],
  );

  const nextSlide = useCallback(async () => {
    await goToSlide(activeSlideIndex + 1);
  }, [activeSlideIndex, goToSlide]);

  const prevSlide = useCallback(async () => {
    await goToSlide(activeSlideIndex - 1);
  }, [activeSlideIndex, goToSlide]);

  return {
    slides,
    activeSlideIndex,
    currentSlide: slides[activeSlideIndex] ?? null,
    nextSlide,
    prevSlide,
    goToSlide,
    projectSlide,
  };
}
