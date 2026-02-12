import { useCallback } from "react";
import { usePresentationStore } from "../stores/presentation-store";
import { setCurrentSlide, setSlideContext } from "../lib/tauri";
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

  const projectSlideWithContext = useCallback(
    async (
      slide: SlideContent,
      next: SlideContent | null,
      index: number,
      total: number,
      title: string,
    ) => {
      await setCurrentSlide(slideContentToFlat(slide));
      await setSlideContext({
        next: next ? slideContentToFlat(next) : null,
        index,
        total,
        title,
      });
    },
    [],
  );

  const goToSlide = useCallback(
    async (index: number) => {
      const state = usePresentationStore.getState();
      if (index >= 0 && index < state.slides.length) {
        state.setActiveSlideIndex(index);
        const slide = state.slides[index];
        const next = index + 1 < state.slides.length ? state.slides[index + 1] : null;
        const title = getSlideTitle(slide);
        await projectSlideWithContext(slide, next, index, state.slides.length, title);
      }
    },
    [projectSlideWithContext],
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
    projectSlideWithContext,
  };
}

/** Extract a display title from a slide for the return monitor */
function getSlideTitle(slide: SlideContent): string {
  switch (slide.type) {
    case "cover":
      return slide.title;
    case "lyrics":
      return slide.label ?? "Lyrics";
    case "bible":
      return `${slide.book} ${slide.chapter}:${slide.verseStart}-${slide.verseEnd}`;
    case "text":
      return slide.text.substring(0, 40);
    case "pause":
      return "Pause";
    case "image":
      return slide.alt ?? "Image";
    case "video":
      return "Video";
  }
}
