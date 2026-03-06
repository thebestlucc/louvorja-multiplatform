import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { usePresentation2 } from "../../hooks/use-presentation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { SlideList } from "../../components/slides/slide-list";
import { SlideEditor } from "../../components/slides/slide-editor";
import { AspectRatioSelector } from "../../components/slides/aspect-ratio-selector";
import { TransitionSelector } from "../../components/slides/transition-selector";
import type { SlideContent } from "../../lib/bindings";
import { projectSlideIndex } from "../../lib/projection-playback";
import { usePresentationStore } from "../../stores/presentation-store";

import { useQueueStore } from "../../stores/queue-store";

export const Route = createFileRoute("/presentations/$presentationId")({
  component: PresentationDetail,
});

function PresentationDetail() {
  const { presentationId } = Route.useParams();
  const id = Number(presentationId);
  const { t } = useTranslation();
  const router = useRouter();
  
  const {
    presentation,
    slides,
    slideContents,
    activeSlideIndex,
    setActiveSlideIndex,
    addSlide,
    deleteSlideAt,
    duplicateSlide,
    updateSlideContent,
    reorderSlides,
    updateMeta,
  } = usePresentation2({ presentationId: id });

  const [localTitle, setLocalTitle] = useState("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setCurrentPresentation = usePresentationStore((s) => s.setCurrentPresentation);
  const setPresentationSlides = usePresentationStore((s) => s.setSlides);
  const setPresentationActiveSlideIndex = usePresentationStore((s) => s.setActiveSlideIndex);

  const [transition, setTransition] = useState("fade");

  useEffect(() => {
    if (presentation) {
      setLocalTitle(presentation.title);
    }
  }, [presentation]);

  const handleLoadSlides = useCallback(async () => {
    if (slideContents.length === 0) {
      notify.error(t("presentations.emptyPresentation"));
      return;
    }

    await catcher(async () => {
      // 1. Set the current presentation context in the store
      setCurrentPresentation(id);
      setPresentationSlides(slideContents);
      setPresentationActiveSlideIndex(0);

      // 2. Clear queue and add this presentation
      useQueueStore.getState().addToQueue([{
        id: crypto.randomUUID(),
        title: presentation?.title || "Presentation",
        type: "projection"
      }], true);

      // 3. Project the first slide
      await projectSlideIndex(0);

      // Update local UI state
      setActiveSlideIndex(0);

      void router.navigate({ to: "/operator" });
    }, { notify: true });
  }, [id, slideContents, setActiveSlideIndex, t, setCurrentPresentation, setPresentationSlides, setPresentationActiveSlideIndex, router]);

  const handleExport = async () => {
    if (!presentation) return;
    const path = await saveDialog({
      defaultPath: `${presentation.title}.slja`,
      filters: [{ name: "LouvorJA Presentation", extensions: ["slja"] }],
    });
    if (path) {
      // Export logic would go here
    }
  };

  const handleTitleChange = (title: string) => {
    setLocalTitle(title);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      if (presentation) {
        updateMeta(title, presentation.aspectRatio);
      }
    }, 1000);
  };

  const handleAspectRatioChange = (ratio: string) => {
    if (presentation) {
      updateMeta(localTitle, ratio);
    }
  };

  if (!presentation) {
    return <div className="p-4">{t("hymnal.loading")}</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/presentations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-1 items-center gap-3">
          <Input
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="max-w-md border-none bg-transparent text-xl font-semibold focus-visible:ring-0 px-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("presentations.export")}
          </Button>
          <Button size="sm" onClick={handleLoadSlides}>
            {t("presentations.project")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Slide List */}
        <div className="w-64 shrink-0 overflow-hidden rounded-lg border border-border bg-surface flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-medium">{t("presentations.slides")}</h2>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addSlide}>
              {t("actions.add")}
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <SlideList
              slides={slideContents}
              activeIndex={activeSlideIndex}
              onSelect={setActiveSlideIndex}
              onReorder={reorderSlides}
              onDelete={deleteSlideAt}
              onDuplicate={duplicateSlide}
            />
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex flex-1 flex-col gap-4 overflow-auto rounded-lg border border-border bg-surface p-4">
          {slides[activeSlideIndex] ? (
            <SlideEditor
              slide={slides[activeSlideIndex].content}
              presentationId={id}
              onChange={(content: SlideContent) => updateSlideContent(activeSlideIndex, content)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {t("presentations.noSlideSelected")}
            </div>
          )}
        </div>

        {/* Settings Sidebar */}
        <div className="w-64 shrink-0 space-y-4 overflow-auto rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">{t("presentations.settings")}</h2>
          <AspectRatioSelector
            value={presentation.aspectRatio}
            onChange={handleAspectRatioChange}
          />
          <TransitionSelector
            value={transition}
            onChange={setTransition}
          />
        </div>
      </div>
    </div>
  );
}
