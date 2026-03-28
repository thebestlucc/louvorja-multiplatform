import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Download,
  Play,
  ChevronRight,
  Layers,
  Plus,
  Copy,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  Type,
  Image,
  Film,
  BookOpen,
  Pause,
  LayoutTemplate,
  Palette,
  Info,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { usePresentation2 } from "../../hooks/use-presentation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { SlideList } from "../../components/slides/slide-list";
import { SlideEditor } from "../../components/slides/slide-editor";
import { AspectRatioSelector } from "../../components/slides/aspect-ratio-selector";
import { TransitionSelector } from "../../components/slides/transition-selector";
import { SlideRenderer } from "../../components/slides/slide-renderer";
import type { SlideContent } from "../../lib/bindings";
import { projectSlideIndex } from "../../lib/projection-playback";
import { usePresentationStore } from "../../stores/presentation-store";
import { cn } from "../../lib/utils";

import { useQueueStore } from "../../stores/queue-store";
import { useMediaPlayerStore } from "../../stores/media-player-store";

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
  const setPresentationSlides = usePresentationStore((s) => s.setSlides);
  const setPresentationActiveSlideIndex = usePresentationStore((s) => s.setActiveSlideIndex);

  const [transition, setTransition] = useState("fade");
  const [settingsTab, setSettingsTab] = useState<"design" | "transition">("design");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

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
      setCurrentPresentation(id);
      setPresentationSlides(slideContents);
      setPresentationActiveSlideIndex(0);

      useMediaPlayerStore.getState().load({
        type: "presentation",
        presentationId: id,
        slides: slideContents,
      });

      useQueueStore.getState().addToQueue([{
        id: crypto.randomUUID(),
        title: presentation?.title || "Presentation",
        type: "projection"
      }], true);

      await projectSlideIndex(0);
      setActiveSlideIndex(0);

      void router.navigate({ to: "/playing-now" });
    }, { notify: true });
  }, [id, slideContents, setActiveSlideIndex, t, setCurrentPresentation, setPresentationSlides, setPresentationActiveSlideIndex, router, presentation?.title]);

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

    const emptyProps: SlideContent = {
      slideType: newType as SlideContent["slideType"],
      text: null,
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
      videoUrl: null,
      videoId: null,
      videoSource: null,
      videoTitle: null,
    };

    switch (newType) {
      case "cover":
        updateSlideContent(activeSlideIndex, { ...emptyProps, slideType: "cover", title: "", subtitle: "" });
        break;
      case "lyrics":
        updateSlideContent(activeSlideIndex, { ...emptyProps, slideType: "lyrics", text: "", label: "" });
        break;
      case "text":
        updateSlideContent(activeSlideIndex, { ...emptyProps, slideType: "text", text: "" });
        break;
      case "image":
        updateSlideContent(activeSlideIndex, { ...emptyProps, slideType: "image", backgroundImage: "", label: "" });
        break;
      case "video":
        updateSlideContent(activeSlideIndex, {
          ...emptyProps,
          slideType: "video",
          videoPath: "",
          autoPlay: true,
          loop: false,
          muted: false,
          mode: "fullscreen",
          text: "",
          textColor: "#ffffff",
          textSize: 42,
        });
        break;
      case "pause":
        updateSlideContent(activeSlideIndex, { ...emptyProps, slideType: "pause" });
        break;
    }
  };

  if (!presentation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      </div>
    );
  }

  const slideTypeKeys = ["cover", "lyrics", "text", "image", "video", "pause"] as const;

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar - PowerPoint-style */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        {/* Left: Back + breadcrumb + title */}
        <Link to="/presentations" className="shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("actions.back")}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Link
            to="/presentations"
            className="shrink-0 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {t("nav.presentations")}
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-hidden="true" />
          <Input
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-7 max-w-[200px] border-none bg-transparent text-sm font-semibold text-foreground shadow-none focus-visible:bg-surface focus-visible:ring-1 focus-visible:ring-primary px-1.5"
            aria-label={t("presentations.title")}
          />
        </nav>

        {/* Center: info badges */}
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline" className="text-[10px] font-normal h-5 px-1.5">
            {presentation.aspectRatio}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5">
            <Layers className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
            {slideContents.length} {t("presentations.slides").toLowerCase()}
          </Badge>
        </div>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        {/* Action buttons with tooltips */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addSlide} aria-label={t("actions.add")}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presentations.noSlides").split(".")[0].replace("No slides", t("actions.add") + " " + t("presentations.slide"))}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => slides[activeSlideIndex] && duplicateSlide(activeSlideIndex)}
                disabled={!slides[activeSlideIndex]}
                aria-label={t("services.duplicate")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("services.duplicate")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => slides[activeSlideIndex] && deleteSlideAt(activeSlideIndex)}
                disabled={!slides[activeSlideIndex]}
                aria-label={t("actions.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("actions.delete")}</TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLoadSlides} aria-label={t("presentations.project")}>
                <Play className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presentations.project")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExport} aria-label={t("presentations.export")}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presentations.export")}</TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setRightPanelOpen((v) => !v)}
                aria-label={rightPanelOpen ? t("actions.close") : t("actions.open")}
              >
                {rightPanelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presentations.settings")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main content area - 3 columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Slide thumbnail strip */}
        <div className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("presentations.slides")}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-primary"
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
        <div className="flex flex-1 flex-col overflow-hidden bg-neutral-900/60">
          {slides[activeSlideIndex] ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              {/* Canvas container with aspect-ratio */}
              <div className="w-full max-w-3xl">
                <div
                  className="relative mx-auto overflow-hidden rounded-sm shadow-2xl ring-1 ring-white/10"
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
                  <span className="text-xs text-white/40">
                    {t("presentations.slide")} {activeSlideIndex + 1} / {slideContents.length}
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
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80",
                              )}
                              onClick={() => handleTypeQuickSwitch(type)}
                              aria-label={t(`presentations.types.${type}`)}
                              aria-pressed={isActive}
                            >
                              <Icon className="h-3 w-3" aria-hidden="true" />
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
                <div className="rounded-lg bg-surface/90 backdrop-blur-sm border border-border p-4">
                  <SlideEditor
                    slide={slides[activeSlideIndex].content}
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
                <Layers className="h-10 w-10 text-white/15" />
              </div>
              <p className="text-sm text-white/40">
                {t("presentations.noSlideSelected")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/60 hover:bg-white/10 hover:text-white/80"
                onClick={addSlide}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("actions.add")} {t("presentations.slide")}
              </Button>
            </div>
          )}
        </div>

        {/* Right: Property panel (collapsible) */}
        {rightPanelOpen && (
          <div className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors duration-150",
                  settingsTab === "design"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSettingsTab("design")}
                aria-label={t("presentations.design")}
              >
                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                {t("presentations.design")}
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors duration-150",
                  settingsTab === "transition"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSettingsTab("transition")}
                aria-label={t("presentations.transition")}
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
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

                  {/* Background color */}
                  {activeSlideContent && (
                    <div>
                      <label className="mb-2 block text-xs font-medium text-muted-foreground">
                        {t("presentations.bgSolid")}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeSlideContent.backgroundColor || "#000000"}
                          onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, backgroundColor: e.target.value })}
                          className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                          aria-label={t("presentations.bgSolid")}
                        />
                        <Input
                          value={activeSlideContent.backgroundColor || "#000000"}
                          onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, backgroundColor: e.target.value })}
                          className="h-8 flex-1 text-xs font-mono"
                          aria-label={t("presentations.bgSolid")}
                        />
                      </div>
                    </div>
                  )}

                  {/* Text color */}
                  {activeSlideContent && (activeSlideContent.slideType === "text" || activeSlideContent.slideType === "lyrics" || activeSlideContent.slideType === "cover") && (
                    <div>
                      <label className="mb-2 block text-xs font-medium text-muted-foreground">
                        {t("presentations.text")} color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeSlideContent.textColor || "#ffffff"}
                          onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, textColor: e.target.value })}
                          className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                          aria-label="Text color"
                        />
                        <Input
                          value={activeSlideContent.textColor || "#ffffff"}
                          onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, textColor: e.target.value })}
                          className="h-8 flex-1 text-xs font-mono"
                          aria-label="Text color"
                        />
                      </div>
                    </div>
                  )}

                  {/* Text size slider */}
                  {activeSlideContent && (activeSlideContent.slideType === "text" || activeSlideContent.slideType === "lyrics" || activeSlideContent.slideType === "cover") && (
                    <div>
                      <label className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>{t("presentations.text")} size</span>
                        <span className="font-mono text-foreground">{activeSlideContent.textSize || 42}px</span>
                      </label>
                      <input
                        type="range"
                        min={12}
                        max={120}
                        step={1}
                        value={activeSlideContent.textSize || 42}
                        onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, textSize: Number(e.target.value) })}
                        className="w-full accent-primary"
                        aria-label="Text size"
                      />
                    </div>
                  )}
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
        )}
      </div>
    </div>
  );
}
