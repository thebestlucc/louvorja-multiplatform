import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Plus,
  Type,
  Image,
  Film,
  BookOpen,
  Pause,
  LayoutTemplate,
  Globe,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { usePresentation2 } from "../../hooks/use-presentation";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { SlideList } from "../../components/slides/slide-list";
import { SlideEditor } from "../../components/slides/slide-editor";
import { SlideRenderer } from "../../components/slides/slide-renderer";
import type { SlideContent } from "../../lib/bindings";
import { defaultSlide } from "../../types/presentation";
import type { SlideType } from "../../types/presentation";
import { projectSlideIndex, clearActivePlayback } from "../../lib/projection-playback";
import { usePresentationStore } from "../../stores/presentation-store";
import { useUpdateSlideNotes } from "../../lib/queries/slides";
import { cn } from "../../lib/utils";
import { useQueueStore } from "../../stores/queue-store";
import { useMediaPlayerStore } from "../../stores/media-player-store";
import { PresentationToolbar } from "./-_presentation-toolbar";
import { PresentationPropertyPanel } from "./-_presentation-property-panel";

export const Route = createFileRoute("/presentations/$presentationId")({
  component: PresentationDetail,
});

const SLIDE_TYPE_ICONS: Record<string, typeof Type> = {
  cover: LayoutTemplate,
  lyrics: BookOpen,
  text: Type,
  image: Image,
  video: Film,
  pause: Pause,
  bible: BookOpen,
  onlineVideo: Globe,
};

function PresentationDetail() {
  const { presentationId } = Route.useParams();
  const id = Number(presentationId);
  const { t } = useTranslation();
  const router = useRouter();

  const {
    presentation,
    slides,
    slideContents,
    slideIds,
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

  const [transition, setTransition] = useState("fade");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Notes state
  const updateNotesMutation = useUpdateSlideNotes();
  const [localNotes, setLocalNotes] = useState("");
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeSlide = slides[activeSlideIndex] ?? null;

  useEffect(() => {
    if (presentation) {
      setLocalTitle(presentation.title);
    }
  }, [presentation]);

  // Sync notes from active slide
  useEffect(() => {
    const raw = slides[activeSlideIndex];
    setLocalNotes(raw?.notes ?? "");
  }, [activeSlideIndex, slides]);

  const handleNotesChange = (notes: string) => {
    setLocalNotes(notes);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    const slide = slides[activeSlideIndex];
    if (!slide) return;
    notesTimerRef.current = setTimeout(() => {
      updateNotesMutation.mutate({ id: slide.id, notes, presentationId: id });
    }, 800);
  };

  const handleLoadSlides = useCallback(async () => {
    if (slideContents.length === 0) {
      notify.error(t("presentations.emptyPresentation"));
      return;
    }

    await catcher(async () => {
      await clearActivePlayback();
      setCurrentPresentation(id);

      useMediaPlayerStore.getState().load({
        type: "presentation",
        presentationId: id,
        slides: slideContents,
      });

      useQueueStore.getState().addToQueue([{
        id: crypto.randomUUID(),
        kind: "hymn",
        title: presentation?.title || "Presentation",
        type: "projection"
      }], true);

      await projectSlideIndex(0);
      setActiveSlideIndex(0);

      router.navigate({ to: "/playing-now" });
    }, { notify: true });
  }, [id, slideContents, setActiveSlideIndex, t, setCurrentPresentation, router, presentation?.title]);

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

  const activeSlideContent = slideContents[activeSlideIndex] ?? null;
  const activeSlideType = activeSlideContent?.slideType ?? null;

  const handleTypeQuickSwitch = (newType: string) => {
    if (!activeSlideContent) return;
    if (activeSlideContent.slideType === newType) return;
    updateSlideContent(activeSlideIndex, defaultSlide(newType as SlideType));
  };

  if (!presentation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      </div>
    );
  }

  const slideTypeKeys = ["cover", "lyrics", "text", "image", "video", "pause", "bible", "onlineVideo"] as const;

  return (
    <div className="flex h-full flex-col bg-[#0d1117]" data-theme="black">
      <PresentationToolbar
        presentation={presentation}
        hasActiveSlide={!!activeSlide}
        slideCount={slideContents.length}
        localTitle={localTitle}
        rightPanelOpen={rightPanelOpen}
        onTitleChange={handleTitleChange}
        onAddSlide={addSlide}
        onDuplicateSlide={() => duplicateSlide(activeSlideIndex)}
        onDeleteSlide={() => deleteSlideAt(activeSlideIndex)}
        onLoadSlides={handleLoadSlides}
        onExport={handleExport}
        onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
      />

      {/* Main content area - 3 columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Slide thumbnail strip */}
        <div className="flex w-52 shrink-0 flex-col border-r border-white/10 bg-[#161b22]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {t("presentations.slides")}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/40 hover:text-amber-400"
                  onClick={addSlide}
                  aria-label={t("actions.add")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("actions.add")}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <SlideList
              slides={slideContents}
              activeIndex={activeSlideIndex}
              onSelect={setActiveSlideIndex}
              onReorder={reorderSlides}
              onDelete={deleteSlideAt}
              onDuplicate={duplicateSlide}
              itemIds={slideIds}
            />
          </div>
        </div>

        {/* Center: The stage */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0d1117]">
          {activeSlide ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              {/* Canvas container with aspect-ratio */}
              <div className="w-full max-w-3xl">
                <div
                  className="relative mx-auto overflow-hidden rounded-sm shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                  style={{
                    aspectRatio: presentation.aspectRatio === "4:3" ? "4/3" : presentation.aspectRatio === "1:1" ? "1/1" : "16/9",
                  }}
                >
                  <SlideRenderer
                    slide={activeSlideContent}
                    renderMode="editor"
                    className="absolute inset-0 h-full w-full"
                  />
                </div>

                {/* Below canvas: slide number + type quick switcher */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-white/30 font-mono">
                    {activeSlideIndex + 1} / {slideContents.length}
                  </span>

                  {/* Type quick-switch pills */}
                  <div className="flex items-center gap-1">
                    {slideTypeKeys.map((type) => {
                      const Icon = SLIDE_TYPE_ICONS[type];
                      const isActive = activeSlideType === type;
                      return (
                        <Tooltip key={type}>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-150",
                                isActive
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                  : "bg-white/5 text-white/40 border border-white/10 hover:border-amber-500/30 hover:text-white/60",
                              )}
                              onClick={() => handleTypeQuickSwitch(type)}
                              aria-label={t(`presentations.types.${type}`)}
                              aria-pressed={isActive}
                            >
                              {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                              <span className="hidden sm:inline">{t(`presentations.types.${type}`)}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t(`presentations.types.${type}`)}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Editor fields below canvas */}
              <div className="mt-4 w-full max-w-3xl">
                <div className="rounded-lg bg-[#161b22] border border-white/10 p-4">
                  <SlideEditor
                    slide={activeSlide.content}
                    presentationId={id}
                    onChange={(content: SlideContent) => updateSlideContent(activeSlideIndex, content)}
                    hidePreview
                    hideTypeSelector
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                <Layers className="h-10 w-10 text-white/10" />
              </div>
              <p className="text-sm text-white/30">
                {t("presentations.noSlideSelected")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/50 hover:bg-white/10 hover:text-white/70 hover:border-amber-500/30"
                onClick={addSlide}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("actions.add")} {t("presentations.slide")}
              </Button>
            </div>
          )}
        </div>

        {/* Right: Property panel */}
        {rightPanelOpen && (
          <PresentationPropertyPanel
            presentation={presentation}
            hasActiveSlide={!!activeSlide}
            activeSlideContent={activeSlideContent}
            activeSlideIndex={activeSlideIndex}
            localNotes={localNotes}
            transition={transition}
            onAspectRatioChange={handleAspectRatioChange}
            onUpdateSlideContent={updateSlideContent}
            onNotesChange={handleNotesChange}
            onTransitionChange={setTransition}
          />
        )}
      </div>
    </div>
  );
}
