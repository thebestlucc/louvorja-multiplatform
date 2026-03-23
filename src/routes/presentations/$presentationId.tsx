import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, Play, ChevronRight, Layers } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { usePresentation2 } from "../../hooks/use-presentation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { SlideList } from "../../components/slides/slide-list";
import { SlideEditor } from "../../components/slides/slide-editor";
import { AspectRatioSelector } from "../../components/slides/aspect-ratio-selector";
import { TransitionSelector } from "../../components/slides/transition-selector";
import type { SlideContent } from "../../lib/bindings";
import { projectSlideIndex } from "../../lib/projection-playback";
import { usePresentationStore } from "../../stores/presentation-store";
import { cn } from "../../lib/utils";

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
  const [settingsTab, setSettingsTab] = useState<"design" | "transition">("design");

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

      void router.navigate({ to: "/playing-now" });
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
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        {/* Breadcrumb */}
        <Link to="/presentations" className="shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("actions.back")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <Link
            to="/presentations"
            className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {t("nav.presentations")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          <Input
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-8 max-w-xs border-none bg-transparent text-sm font-semibold text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-primary px-1.5"
            aria-label={t("presentations.title")}
          />
        </nav>

        {/* Center info */}
        <div className="flex items-center gap-2 ml-auto mr-4">
          <Badge variant="outline" className="text-[11px] font-normal">
            {presentation.aspectRatio}
          </Badge>
          <Badge variant="secondary" className="text-[11px] font-normal">
            <Layers className="mr-1 h-3 w-3" aria-hidden="true" />
            {slideContents.length} {t("presentations.slides").toLowerCase()}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("presentations.export")}
          </Button>
          <Button size="sm" onClick={handleLoadSlides} className="h-8">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {t("presentations.project")}
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide list panel — wider */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("presentations.slides")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:text-primary"
              onClick={addSlide}
            >
              {t("actions.add")}
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-3">
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

        {/* Editor area — center */}
        <div className="flex flex-1 flex-col overflow-auto bg-background p-6">
          {slides[activeSlideIndex] ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              {/* Slide canvas with aspect-ratio */}
              <div className="w-full max-w-3xl">
                <div className="overflow-hidden rounded-lg shadow-xl ring-1 ring-border">
                  <SlideEditor
                    slide={slides[activeSlideIndex].content}
                    presentationId={id}
                    onChange={(content: SlideContent) => updateSlideContent(activeSlideIndex, content)}
                  />
                </div>
                {/* Slide info bar */}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t("presentations.slide")} {activeSlideIndex + 1} / {slideContents.length}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
                <Layers className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("presentations.noSlideSelected")}
              </p>
            </div>
          )}
        </div>

        {/* Settings sidebar — right */}
        <div className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-medium transition-colors duration-150",
                settingsTab === "design"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSettingsTab("design")}
            >
              {t("presentations.design")}
            </button>
            <button
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-medium transition-colors duration-150",
                settingsTab === "transition"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSettingsTab("transition")}
            >
              {t("presentations.transition")}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {settingsTab === "design" ? (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    {t("presentations.aspectRatio")}
                  </label>
                  <AspectRatioSelector
                    value={presentation.aspectRatio}
                    onChange={handleAspectRatioChange}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">
                    {t("presentations.transition")}
                  </label>
                  <TransitionSelector
                    value={transition}
                    onChange={setTransition}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
