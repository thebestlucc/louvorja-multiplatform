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
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import type { Presentation } from "../../lib/bindings";

export interface PresentationToolbarProps {
  presentation: Presentation;
  hasActiveSlide: boolean;
  slideCount: number;
  localTitle: string;
  rightPanelOpen: boolean;
  onTitleChange: (title: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onLoadSlides: () => void;
  onExport: () => void;
  onToggleRightPanel: () => void;
}

export function PresentationToolbar({
  presentation,
  hasActiveSlide,
  slideCount,
  localTitle,
  rightPanelOpen,
  onTitleChange,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onLoadSlides,
  onExport,
  onToggleRightPanel,
}: PresentationToolbarProps) {
  const { t } = useTranslation();

  return (
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
          onChange={(e) => onTitleChange(e.target.value)}
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
          {slideCount} {t("presentations.slides").toLowerCase()}
        </Badge>
      </div>

      <div className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={onAddSlide} aria-label={t("actions.add")}>
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
              onClick={() => hasActiveSlide && onDuplicateSlide()}
              disabled={!hasActiveSlide}
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
              onClick={() => hasActiveSlide && onDeleteSlide()}
              disabled={!hasActiveSlide}
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
            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-400 hover:text-amber-300" onClick={onLoadSlides} aria-label={t("presentations.project")}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("presentations.project")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={onExport} aria-label={t("presentations.export")}>
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
              onClick={onToggleRightPanel}
              aria-label={rightPanelOpen ? t("actions.close") : t("actions.open")}
            >
              {rightPanelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("presentations.settings")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
