import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../lib/bindings";
import type { SlideType } from "../../types/presentation";
import { defaultSlide } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { cn } from "../../lib/utils";
import {
  CoverFields,
  LyricsFields,
  TextFields,
  ImageFields,
  VideoFields,
  OnlineVideoFields,
  BibleFields,
} from "./fields";

interface SlideEditorProps {
  slide: SlideContent;
  presentationId: number;
  onChange: (content: SlideContent) => void;
  /** Hide the inline preview (when preview is rendered separately, e.g. on the stage) */
  hidePreview?: boolean;
  /** Hide the slide type dropdown (when type switching is handled externally) */
  hideTypeSelector?: boolean;
}

const SLIDE_TYPES: SlideType[] = ["cover", "lyrics", "pause", "text", "image", "video", "onlineVideo"];

export function SlideEditor({ slide, presentationId: _presentationId, onChange, hidePreview, hideTypeSelector }: SlideEditorProps) {
  const { t } = useTranslation();

  const handleTypeChange = (newType: string) => {
    onChange(defaultSlide(newType as SlideType));
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Preview (hidden when rendered externally on the stage) */}
      {!hidePreview && (
        <div className="mx-auto w-full max-w-2xl">
          <div className="aspect-video overflow-hidden rounded-lg border border-border">
            <SlideRenderer slide={slide} renderMode="editor" className="h-full w-full" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={cn("flex flex-col gap-3", !hidePreview && "rounded-lg border border-border bg-surface p-4")}>
        {/* Slide type selector (hidden when managed externally) */}
        {!hideTypeSelector && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
            {t("presentations.slideType")}
          </label>
          <Select value={slide.slideType} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLIDE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`presentations.types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* Type-specific fields */}
        {slide.slideType === "cover" && (
          <CoverFields
            title={slide.title}
            subtitle={slide.subtitle}
            onChange={(title, subtitle) => onChange({ ...slide, title, subtitle })}
          />
        )}

        {slide.slideType === "lyrics" && (
          <LyricsFields
            text={slide.text}
            label={slide.label}
            onChange={(text, label) => onChange({ ...slide, text, label })}
          />
        )}

        {slide.slideType === "text" && (
          <TextFields
            content={slide.content}
            onChange={(content) => onChange({ ...slide, content })}
          />
        )}

        {slide.slideType === "image" && (
          <ImageFields
            path={slide.path}
            caption={slide.caption}
            fit={slide.fit}
            onChange={(path, caption, fit) => onChange({ ...slide, path, caption, fit })}
          />
        )}

        {slide.slideType === "video" && (
          <VideoFields
            slide={slide}
            onChange={(next) => onChange(next)}
          />
        )}

        {slide.slideType === "onlineVideo" && (
          <OnlineVideoFields
            slide={slide}
            onChange={(next) => onChange(next)}
          />
        )}

        {slide.slideType === "bible" && (
          <BibleFields
            slide={slide}
            onChange={(next) => onChange(next)}
          />
        )}
      </div>
    </div>
  );
}
