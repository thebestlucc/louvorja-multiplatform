import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Download,
  Play,
  ChevronRight,
  ChevronDown,
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
  SlidersHorizontal,
  FileText,
  Globe,
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
import { defaultSlide } from "../../types/presentation";
import type { SlideType } from "../../types/presentation";
import { projectSlideIndex, clearActivePlayback } from "../../lib/projection-playback";
import { usePresentationStore } from "../../stores/presentation-store";
import { useUpdateSlideNotes } from "../../lib/queries/slides";
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
  const [bgOpen, setBgOpen] = useState(true);
  const [typoOpen, setTypoOpen] = useState(true);
  const [transOpen, setTransOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

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

  // Check if slide type supports text styling
  const hasTextStyling = activeSlideContent && (
    activeSlideContent.slideType === "cover" ||
    activeSlideContent.slideType === "lyrics" ||
    activeSlideContent.slideType === "text" ||
    activeSlideContent.slideType === "bible"
  );

  // Check if slide type has background config
  const hasBackground = activeSlideContent && activeSlideContent.slideType !== "pause" &&
    activeSlideContent.slideType !== "video" && activeSlideContent.slideType !== "onlineVideo";

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
      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#161b22] px-3 py-1.5">
        {/* Left: Back + breadcrumb + title */}
        <Link to="/presentations" className="shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" aria-label={t("actions.back")}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Link
            to="/presentations"
            className="shrink-0 text-xs text-white/40 transition-colors duration-150 hover:text-white/70"
          >
            {t("nav.presentations")}
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-white/20" aria-hidden="true" />
          <Input
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-7 max-w-50 border-none bg-transparent text-sm font-semibold text-white shadow-none focus-visible:bg-white/5 focus-visible:ring-1 focus-visible:ring-amber-500/50 px-1.5"
            aria-label={t("presentations.title")}
          />
        </nav>

        {/* Center: info badges */}
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline" className="text-[10px] font-normal h-5 px-1.5 border-white/20 text-white/50">
            {presentation.aspectRatio}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5 bg-white/10 text-white/50 border-0">
            <Layers className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
            {slideContents.length} {t("presentations.slides").toLowerCase()}
          </Badge>
        </div>

        <div className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={addSlide} aria-label={t("actions.add")}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("actions.add")} {t("presentations.slide")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-white"
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
                className="h-7 w-7 text-white/60 hover:text-destructive"
                onClick={() => slides[activeSlideIndex] && deleteSlideAt(activeSlideIndex)}
                disabled={!slides[activeSlideIndex]}
                aria-label={t("actions.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("actions.delete")}</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-400 hover:text-amber-300" onClick={handleLoadSlides} aria-label={t("presentations.project")}>
                <Play className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presentations.project")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={handleExport} aria-label={t("presentations.export")}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presentations.export")}</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-white"
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

        {/* Right: Property panel (collapsible sections) */}
        {rightPanelOpen && (
          <div className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-[#161b22]">
            <div className="flex-1 overflow-auto">
              {/* Background section */}
              {hasBackground && (
                <CollapsibleSection
                  title={t("presentations.bgSolid")}
                  icon={<Palette className="h-3.5 w-3.5" />}
                  open={bgOpen}
                  onToggle={() => setBgOpen((v) => !v)}
                >
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/40">
                        {t("presentations.aspectRatio")}
                      </label>
                      <AspectRatioSelector
                        value={presentation.aspectRatio}
                        onChange={handleAspectRatioChange}
                      />
                    </div>

                    {activeSlideContent && "background" in activeSlideContent && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/40">
                          {t("presentations.bgSolid")}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={getBgColor(activeSlideContent)}
                            onChange={(e) => updateBgColor(activeSlideContent, e.target.value, activeSlideIndex, updateSlideContent)}
                            className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                            aria-label={t("presentations.bgSolid")}
                          />
                          <Input
                            value={getBgColor(activeSlideContent)}
                            onChange={(e) => updateBgColor(activeSlideContent, e.target.value, activeSlideIndex, updateSlideContent)}
                            className="h-8 flex-1 text-xs font-mono bg-white/5 border-white/10 text-white/70"
                            aria-label={t("presentations.bgSolid")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Typography section */}
              {hasTextStyling && (
                <CollapsibleSection
                  title={t("presentations.editorTypography")}
                  icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                  open={typoOpen}
                  onToggle={() => setTypoOpen((v) => !v)}
                >
                  <div className="space-y-3">
                    {activeSlideContent && "text_color" in activeSlideContent && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-white/40">
                            {t("presentations.videoTextColor")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={getTextColor(activeSlideContent)}
                              onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, text_color: e.target.value } as SlideContent)}
                              className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                              aria-label={t("presentations.videoTextColor")}
                            />
                            <Input
                              value={getTextColor(activeSlideContent)}
                              onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, text_color: e.target.value } as SlideContent)}
                              className="h-8 flex-1 text-xs font-mono bg-white/5 border-white/10 text-white/70"
                              aria-label={t("presentations.videoTextColor")}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-white/40">
                            <span>{t("presentations.videoTextSize")}</span>
                            <span className="font-mono text-amber-400">{getTextSize(activeSlideContent)}px</span>
                          </label>
                          <input
                            type="range"
                            min={12}
                            max={120}
                            step={1}
                            value={getTextSize(activeSlideContent)}
                            onChange={(e) => updateSlideContent(activeSlideIndex, { ...activeSlideContent, text_size: Number(e.target.value) } as SlideContent)}
                            className="w-full accent-amber-500"
                            aria-label={t("presentations.videoTextSize")}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Transition section */}
              <CollapsibleSection
                title={t("presentations.transition")}
                icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                open={transOpen}
                onToggle={() => setTransOpen((v) => !v)}
              >
                <TransitionSelector
                  value={transition}
                  onChange={setTransition}
                />
              </CollapsibleSection>

              {/* Notes section */}
              {activeSlide && (
                <CollapsibleSection
                  title={t("presentations.speakerNotes")}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  open={notesOpen}
                  onToggle={() => setNotesOpen((v) => !v)}
                >
                  <textarea
                    className={cn(
                      "w-full min-h-25 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70",
                      "font-mono placeholder:text-white/20",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50",
                      "resize-y",
                    )}
                    value={localNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder={t("presentations.notesPlaceholder")}
                    aria-label={t("presentations.speakerNotes")}
                  />
                </CollapsibleSection>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBgColor(slide: SlideContent): string {
  if ("background" in slide) {
    return (slide as { background: { color: string | null } }).background.color || "#000000";
  }
  return "#000000";
}

function updateBgColor(
  slide: SlideContent,
  color: string,
  index: number,
  updateFn: (index: number, content: SlideContent) => void,
) {
  if ("background" in slide) {
    const bg = { ...(slide as { background: Record<string, unknown> }).background, color };
    updateFn(index, { ...slide, background: bg } as SlideContent);
  }
}

function getTextColor(slide: SlideContent): string {
  if ("text_color" in slide) {
    return (slide as { text_color: string | null }).text_color || "#ffffff";
  }
  return "#ffffff";
}

function getTextSize(slide: SlideContent): number {
  if ("text_size" in slide) {
    return (slide as { text_size: number | null }).text_size || 42;
  }
  return 42;
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-white/60 hover:text-white/80 transition-colors"
        onClick={onToggle}
        aria-expanded={open}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
