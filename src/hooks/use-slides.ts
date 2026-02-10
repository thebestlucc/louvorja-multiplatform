import { useCallback } from "react";
import { usePresentationStore } from "../stores/presentation-store";
import { setCurrentSlide } from "../lib/tauri";
import type { SlideContent } from "../types/presentation";
import { slideContentToFlat } from "../types/presentation";

export function useSlides() {
  const {
    slides,
    activeSlideIndex,
  } = usePresentationStore();

  const projectSlide = useCallback(
    async (slide: SlideContent) => {
      await setCurrentSlide(slideContentToFlat(slide));
    },
    [],
  );

  const goToSlide = useCallback(
    async (index: number) => {
      // Read fresh state to avoid stale closure (e.g. after setSlides + setTimeout)
      const state = usePresentationStore.getState();
      if (index >= 0 && index < state.slides.length) {
        state.setActiveSlideIndex(index);
        await projectSlide(state.slides[index]);
      }
    },
    [projectSlide],
  );

  const nextSlide = useCallback(async () => {
    const { activeSlideIndex: idx } = usePresentationStore.getState();
    await goToSlide(idx + 1);
  }, [goToSlide]);

  const prevSlide = useCallback(async () => {
    const { activeSlideIndex: idx } = usePresentationStore.getState();
    await goToSlide(idx - 1);
  }, [goToSlide]);

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
