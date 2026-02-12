import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { usePresentation2 } from "../../hooks/use-presentation";
import { usePresentationStore } from "../../stores/presentation-store";
import { useSlides as useSlidesNav } from "../../hooks/use-slides";
import { useDisplayStore } from "../../stores/display-store";
import { useExportSlja } from "../../lib/queries";
import { SlideList } from "../../components/slides/slide-list";
import { SlideEditor } from "../../components/slides/slide-editor";
import { AspectRatioSelector } from "../../components/slides/aspect-ratio-selector";
import { TransitionSelector, type TransitionConfig } from "../../components/slides/transition-selector";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { SlideContent } from "../../types/presentation";

export const Route = createFileRoute("/presentations/$presentationId")({
  component: PresentationEditor,
});

function PresentationEditor() {
  const { presentationId } = Route.useParams();
  const { t } = useTranslation();
  const id = Number(presentationId);

  const {
    presentation,
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
  } = usePresentation2({ presentationId: id });

  const { setSlides } = usePresentationStore();
  const { goToSlide } = useSlidesNav();
  const isProjectorOpen = useDisplayStore((s) => s.projectorWindowOpen);
  const exportMutation = useExportSlja();

  // Local title state for responsive typing
  const [localTitle, setLocalTitle] = useState("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleDirtyRef = useRef(false);

  // Sync local title when presentation data loads/changes (only if not actively editing)
  useEffect(() => {
    if (presentation && !titleDirtyRef.current) {
      setLocalTitle(presentation.title);
    }
  }, [presentation]);

  const [transition, setTransition] = useState<TransitionConfig>({
    type: "none",
    durationMs: 500,
  });

  const handleSlideContentChange = useCallback(
    (content: SlideContent) => {
      updateSlideContent(activeSlideIndex, content);
    },
    [activeSlideIndex, updateSlideContent],
  );

  // Load slides into the store and project the current one
  const handleLoadSlides = useCallback(() => {
    setSlides(slideContents);
    if (slideContents.length > 0) {
      goToSlide(0);
    }
  }, [slideContents, goToSlide, setSlides]);

  const handleExport = async () => {
    if (!presentation) return;
    const path = await saveDialog({
      defaultPath: `${presentation.title}.slja`,
      filters: [{ name: "LouvorJA Presentation", extensions: ["slja"] }],
    });
    if (path) {
      exportMutation.mutate({ presentationId: id, path });
    }
  };

  const handleTitleChange = (title: string) => {
    setLocalTitle(title);
    titleDirtyRef.current = true;
    if (!presentation) return;

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      updateMeta(title, presentation.aspect_ratio);
      titleDirtyRef.current = false;
    }, 800);
  };

  // Cleanup title timer
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  const handleAspectRatioChange = (aspectRatio: string) => {
    if (!presentation) return;
    updateMeta(presentation.title, aspectRatio);
  };

  if (!presentation) {
    return <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Link to="/presentations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <Input
          className="max-w-xs font-semibold"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
        />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("presentations.export")}
          </Button>
          <Button
            size="sm"
            onClick={handleLoadSlides}
            disabled={slideContents.length === 0}
          >
            {t("presentations.preview")}
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Left panel — Slide list */}
        <div className="w-52 shrink-0 overflow-hidden rounded-lg border border-border">
          <SlideList
            slides={slideContents}
            activeIndex={activeSlideIndex}
            onSelect={(index) => {
              setActiveSlideIndex(index);
              if (isProjectorOpen) {
                goToSlide(index);
              }
            }}
            onReorder={reorderSlides}
            onAdd={addSlide}
            onDuplicate={duplicateSlide}
            onDelete={deleteSlideAt}
            itemIds={slideIds}
          />
        </div>

        {/* Center panel — Slide editor */}
        <div className="flex-1 overflow-auto">
          {activeSlide ? (
            <SlideEditor
              slide={activeSlide.content}
              onChange={handleSlideContentChange}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">{t("presentations.noSlides")}</p>
            </div>
          )}
        </div>

        {/* Right panel — Properties */}
        <div className="hidden w-56 shrink-0 flex-col gap-4 overflow-auto rounded-lg border border-border p-3 xl:flex">
          <AspectRatioSelector
            value={presentation.aspect_ratio}
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
