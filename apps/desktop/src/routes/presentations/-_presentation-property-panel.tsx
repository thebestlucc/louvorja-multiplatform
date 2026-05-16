import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Palette,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { Input } from "../../components/ui/input";
import { AspectRatioSelector } from "../../components/slides/aspect-ratio-selector";
import { TransitionSelector } from "../../components/slides/transition-selector";
import type { SlideContent, Presentation } from "../../lib/bindings";
import { cn } from "../../lib/utils";

export interface PresentationPropertyPanelProps {
  presentation: Presentation;
  hasActiveSlide: boolean;
  activeSlideContent: SlideContent | null;
  activeSlideIndex: number;
  localNotes: string;
  transition: string;
  onAspectRatioChange: (ratio: string) => void;
  onUpdateSlideContent: (index: number, content: SlideContent) => void;
  onNotesChange: (notes: string) => void;
  onTransitionChange: (transition: string) => void;
}

export function PresentationPropertyPanel({
  presentation,
  hasActiveSlide,
  activeSlideContent,
  activeSlideIndex,
  localNotes,
  transition,
  onAspectRatioChange,
  onUpdateSlideContent,
  onNotesChange,
  onTransitionChange,
}: PresentationPropertyPanelProps) {
  const { t } = useTranslation();
  const [bgOpen, setBgOpen] = useState(true);
  const [typoOpen, setTypoOpen] = useState(true);
  const [transOpen, setTransOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  const hasTextStyling = activeSlideContent && (
    activeSlideContent.slideType === "cover" ||
    activeSlideContent.slideType === "lyrics" ||
    activeSlideContent.slideType === "text" ||
    activeSlideContent.slideType === "bible"
  );

  const hasBackground = activeSlideContent &&
    activeSlideContent.slideType !== "pause" &&
    activeSlideContent.slideType !== "video" &&
    activeSlideContent.slideType !== "onlineVideo";

  return (
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
                  onChange={onAspectRatioChange}
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
                      onChange={(e) => updateBgColor(activeSlideContent, e.target.value, activeSlideIndex, onUpdateSlideContent)}
                      className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                      aria-label={t("presentations.bgSolid")}
                    />
                    <Input
                      value={getBgColor(activeSlideContent)}
                      onChange={(e) => updateBgColor(activeSlideContent, e.target.value, activeSlideIndex, onUpdateSlideContent)}
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
                        onChange={(e) => onUpdateSlideContent(activeSlideIndex, { ...activeSlideContent, text_color: e.target.value } as SlideContent)}
                        className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                        aria-label={t("presentations.videoTextColor")}
                      />
                      <Input
                        value={getTextColor(activeSlideContent)}
                        onChange={(e) => onUpdateSlideContent(activeSlideIndex, { ...activeSlideContent, text_color: e.target.value } as SlideContent)}
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
                      onChange={(e) => onUpdateSlideContent(activeSlideIndex, { ...activeSlideContent, text_size: Number(e.target.value) } as SlideContent)}
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
            onChange={onTransitionChange}
          />
        </CollapsibleSection>

        {/* Notes section */}
        {hasActiveSlide && (
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
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={t("presentations.notesPlaceholder")}
              aria-label={t("presentations.speakerNotes")}
            />
          </CollapsibleSection>
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
