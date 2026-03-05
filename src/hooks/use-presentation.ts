import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSlides, useCreateSlide, useUpdateSlide, useDeleteSlide, useReorderSlides, useUpdatePresentation, usePresentation } from "../lib/queries";
import type { SlideContent, Slide } from "../lib/bindings";

interface UsePresentationOptions {
  presentationId: number;
}

interface SlideWithParsedContent extends Omit<Slide, "content"> {
  content: SlideContent;
}

function parseSlideRow(row: Slide): SlideWithParsedContent {
  let content: SlideContent;
  try {
    content = JSON.parse(row.content) as SlideContent;
  } catch {
    content = {
      slideType: "text",
      text: row.content,
      title: null,
      subtitle: null,
      label: null,
      videoPath: null,
      backgroundImage: null,
      backgroundColor: null,
      audioPath: null,
      autoPlay: null,
      loop: null,
      muted: null,
      mode: null,
      textColor: null,
      textSize: null,
    };
  }
  return {
    ...row,
    content,
  };
}

export function usePresentation2({ presentationId }: UsePresentationOptions) {
  const presentationQuery = usePresentation(presentationId);
  const slidesQuery = useSlides(presentationId);
  const { data: presentation } = presentationQuery;
  const { data: slideRows } = slidesQuery;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Local optimistic slide content overrides (keyed by slide id)
  const [localEdits, setLocalEdits] = useState<Record<number, SlideContent>>({});

  const createSlideMutation = useCreateSlide();
  const updateSlideMutation = useUpdateSlide();
  const deleteSlideMutation = useDeleteSlide();
  const reorderMutation = useReorderSlides();
  const updatePresentationMutation = useUpdatePresentation();

  // Debounced auto-save refs (one timer per slide id)
  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const serverSlides = useMemo(() => {
    return (slideRows ?? []).map(parseSlideRow);
  }, [slideRows]);

  // Merge server slides with local edits for immediate UI response
  const slides: SlideWithParsedContent[] = useMemo(() => {
    return serverSlides.map((s) => {
      const localContent = localEdits[s.id];
      if (localContent) {
        return { ...s, content: localContent };
      }
      return s;
    });
  }, [serverSlides, localEdits]);

  const slideContents = useMemo(() => {
    return slides.map((s) => s.content);
  }, [slides]);

  const slideIds = useMemo(() => {
    return slides.map((s) => s.id);
  }, [slides]);

  const activeSlide = slides[activeSlideIndex] ?? null;
  const isInitialLoading = presentationQuery.isLoading;
  const isPresentationError = presentationQuery.isError;
  const presentationError = presentationQuery.error;
  const refetchPresentation = presentationQuery.refetch;

  // Clear local edit for a slide once server data catches up
  useEffect(() => {
    if (!slideRows) return;
    setLocalEdits((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(next).map(Number)) {
        const serverSlide = serverSlides.find((s) => s.id === id);
        if (serverSlide) {
          const serverJson = JSON.stringify(serverSlide.content);
          const localJson = JSON.stringify(next[id]);
          if (serverJson === localJson) {
            delete next[id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [slideRows, serverSlides]);

  // Update slide content: immediate local state + debounced backend save
  const updateSlideContent = useCallback(
    (index: number, content: SlideContent) => {
      const slide = slides[index];
      if (!slide) return;

      // Immediate local update
      setLocalEdits((prev) => ({ ...prev, [slide.id]: content }));

      // Cancel previous timer for this slide
      const timers = saveTimersRef.current;
      if (timers[slide.id]) clearTimeout(timers[slide.id]);

      // Debounced save
      timers[slide.id] = setTimeout(() => {
        updateSlideMutation.mutate({
          id: slide.id,
          contentJson: JSON.stringify(content),
          presentationId,
        });
        delete timers[slide.id];
      }, 800);
    },
    [slides, presentationId, updateSlideMutation],
  );

  const addSlide = useCallback(() => {
    const sortOrder = slides.length;
    const content: SlideContent = {
      slideType: "text",
      text: "",
      title: null,
      subtitle: null,
      label: null,
      videoPath: null,
      backgroundImage: null,
      backgroundColor: null,
      audioPath: null,
      autoPlay: null,
      loop: null,
      muted: null,
      mode: null,
      textColor: null,
      textSize: null,
    };
    createSlideMutation.mutate({
      presentationId,
      contentJson: JSON.stringify(content),
      sortOrder,
    });
  }, [slides.length, presentationId, createSlideMutation]);

  const deleteSlideAt = useCallback(
    (index: number) => {
      const slide = slides[index];
      if (!slide) return;

      // Clear local edit
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[slide.id];
        return next;
      });

      // Cancel pending save
      const timers = saveTimersRef.current;
      if (timers[slide.id]) {
        clearTimeout(timers[slide.id]);
        delete timers[slide.id];
      }

      deleteSlideMutation.mutate({ id: slide.id, presentationId });
      if (activeSlideIndex >= slides.length - 1 && activeSlideIndex > 0) {
        setActiveSlideIndex(activeSlideIndex - 1);
      }
    },
    [slides, activeSlideIndex, presentationId, deleteSlideMutation],
  );

  const duplicateSlide = useCallback(
    (index: number) => {
      const slide = slides[index];
      if (!slide) return;
      createSlideMutation.mutate({
        presentationId,
        contentJson: JSON.stringify(slide.content),
        sortOrder: index + 1,
      });
    },
    [slides, presentationId, createSlideMutation],
  );

  const reorderSlides = useCallback(
    (from: number, to: number) => {
      const newIds = [...slideIds];
      const [moved] = newIds.splice(from, 1);
      newIds.splice(to, 0, moved);
      reorderMutation.mutate({ presentationId, slideIds: newIds });

      if (activeSlideIndex === from) {
        setActiveSlideIndex(to);
      } else if (from < activeSlideIndex && to >= activeSlideIndex) {
        setActiveSlideIndex(activeSlideIndex - 1);
      } else if (from > activeSlideIndex && to <= activeSlideIndex) {
        setActiveSlideIndex(activeSlideIndex + 1);
      }
    },
    [slideIds, presentationId, activeSlideIndex, reorderMutation],
  );

  const updateMeta = useCallback(
    (title: string, aspectRatio: string) => {
      updatePresentationMutation.mutate({ id: presentationId, title, aspectRatio });
    },
    [presentationId, updatePresentationMutation],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      const timers = saveTimersRef.current;
      for (const id of Object.keys(timers).map(Number)) {
        clearTimeout(timers[id]);
      }
    };
  }, []);

  return {
    presentation,
    presentationQuery,
    slidesQuery,
    isInitialLoading,
    isPresentationError,
    presentationError,
    refetchPresentation,
    slides,
    slideContents,
    slideIds,
    activeSlideIndex,
    activeSlide,
    setActiveSlideIndex,
    addSlide,
    deleteSlideAt,
    duplicateSlide,
    updateSlideContent,
    reorderSlides,
    updateMeta,
  };
}
