import { useTranslation } from "react-i18next";
import type { SlideContent, SlideType } from "../../types/presentation";
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
  defaultVideoSlide,
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

const SLIDE_TYPES: SlideType[] = ["cover", "lyrics", "pause", "text", "image", "video", "online_video"];

const EMPTY_SLIDE_PROPS = {
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

export function SlideEditor({ slide, presentationId: _presentationId, onChange, hidePreview, hideTypeSelector }: SlideEditorProps) {
  const { t } = useTranslation();

  const handleTypeChange = (newType: string) => {
    const type = newType as SlideType;
    switch (type) {
      case "cover":
        onChange({ ...EMPTY_SLIDE_PROPS, slideType: "cover", title: "", subtitle: "" });
        break;
      case "lyrics":
        onChange({ ...EMPTY_SLIDE_PROPS, slideType: "lyrics", text: "", label: "" });
        break;
      case "pause":
        onChange({ ...EMPTY_SLIDE_PROPS, slideType: "pause" });
        break;
      case "text":
        onChange({ ...EMPTY_SLIDE_PROPS, slideType: "text", text: "" });
        break;
      case "image":
        onChange({ ...EMPTY_SLIDE_PROPS, slideType: "image", backgroundImage: "", label: "" });
        break;
      case "video":
        onChange(defaultVideoSlide());
        break;
      case "online_video":
        onChange({ ...EMPTY_SLIDE_PROPS, slideType: "online_video", videoUrl: "", videoId: "", videoSource: "youtube", videoTitle: "" });
        break;
    }
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
            title={slide.title ?? ""}
            subtitle={slide.subtitle ?? ""}
            onChange={(title, subtitle) => onChange({ ...slide, title, subtitle: subtitle || null })}
          />
        )}

        {slide.slideType === "lyrics" && (
          <LyricsFields
            text={slide.text ?? ""}
            label={slide.label ?? ""}
            onChange={(text, label) => onChange({ ...slide, text, label: label || null })}
          />
        )}

        {slide.slideType === "text" && (
          <TextFields
            text={slide.text ?? ""}
            onChange={(text) => onChange({ ...slide, text })}
          />
        )}

        {slide.slideType === "image" && (
          <ImageFields
            src={slide.backgroundImage ?? ""}
            alt={slide.label ?? ""}
            onChange={(src, alt) => onChange({ ...slide, backgroundImage: src, label: alt || null })}
          />
        )}

        {slide.slideType === "video" && (
          <VideoFields
            slide={slide}
            onChange={(next) => onChange(next)}
          />
        )}

        {slide.slideType === "online_video" && (
          <OnlineVideoFields
            slide={slide}
            onChange={(next) => onChange(next)}
          />
        )}
      </div>
    </div>
  );
}
