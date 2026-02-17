import { useTranslation } from "react-i18next";
import type { SlideContent, SlideType, VideoSlideContent, VideoSlideMode } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { cn } from "../../lib/utils";
import { VideoPicker } from "./video-picker";

interface SlideEditorProps {
  slide: SlideContent;
  presentationId: number;
  onChange: (content: SlideContent) => void;
}

const SLIDE_TYPES: SlideType[] = ["cover", "lyrics", "pause", "text", "image", "video"];

export function SlideEditor({ slide, presentationId, onChange }: SlideEditorProps) {
  const { t } = useTranslation();

  const handleTypeChange = (newType: string) => {
    const type = newType as SlideType;
    switch (type) {
      case "cover":
        onChange({ type: "cover", title: "", subtitle: "" });
        break;
      case "lyrics":
        onChange({ type: "lyrics", text: "", label: "" });
        break;
      case "pause":
        onChange({ type: "pause" });
        break;
      case "text":
        onChange({ type: "text", text: "" });
        break;
      case "image":
        onChange({ type: "image", src: "", alt: "" });
        break;
      case "video":
        onChange(defaultVideoSlide());
        break;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Preview */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="aspect-video overflow-hidden rounded-lg border border-border">
          <SlideRenderer slide={slide} renderMode="editor" className="h-full w-full" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        {/* Slide type selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
            {t("presentations.slideType")}
          </label>
          <Select value={slide.type} onValueChange={handleTypeChange}>
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

        {/* Type-specific fields */}
        {slide.type === "cover" && (
          <CoverFields
            title={slide.title}
            subtitle={slide.subtitle}
            onChange={(title, subtitle) => onChange({ ...slide, title, subtitle })}
          />
        )}

        {slide.type === "lyrics" && (
          <LyricsFields
            text={slide.text}
            label={slide.label}
            onChange={(text, label) => onChange({ ...slide, text, label })}
          />
        )}

        {slide.type === "text" && (
          <TextFields
            text={slide.text}
            onChange={(text) => onChange({ ...slide, text })}
          />
        )}

        {slide.type === "image" && (
          <ImageFields
            src={slide.src}
            alt={slide.alt}
            onChange={(src, alt) => onChange({ ...slide, src, alt })}
          />
        )}

        {slide.type === "video" && (
          <VideoFields
            slide={slide}
            presentationId={presentationId}
            onChange={(next) => onChange(next)}
          />
        )}
      </div>
    </div>
  );
}

function CoverFields({ title, subtitle, onChange }: {
  title: string;
  subtitle?: string;
  onChange: (title: string, subtitle?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.title")}
        </label>
        <Input
          value={title}
          onChange={(e) => onChange(e.target.value, subtitle)}
          placeholder={t("presentations.titlePlaceholder")}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.subtitle")}
        </label>
        <Input
          value={subtitle ?? ""}
          onChange={(e) => onChange(title, e.target.value || undefined)}
          placeholder={t("presentations.subtitlePlaceholder")}
        />
      </div>
    </>
  );
}

function LyricsFields({ text, label, onChange }: {
  text: string;
  label?: string;
  onChange: (text: string, label?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.label")}
        </label>
        <Input
          value={label ?? ""}
          onChange={(e) => onChange(text, e.target.value || undefined)}
          placeholder={t("presentations.labelPlaceholder")}
        />
      </div>
      <div className="flex gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-2">
          {t("presentations.text")}
        </label>
        <textarea
          className={cn(
            "flex min-h-[120px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
          value={text}
          onChange={(e) => onChange(e.target.value, label)}
          placeholder={t("presentations.textPlaceholder")}
        />
      </div>
    </>
  );
}

function TextFields({ text, onChange }: {
  text: string;
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      <label className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-2">
        {t("presentations.text")}
      </label>
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("presentations.textPlaceholder")}
      />
    </div>
  );
}

function ImageFields({ src, alt, onChange }: {
  src: string;
  alt?: string;
  onChange: (src: string, alt?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.imagePath")}
        </label>
        <Input
          value={src}
          onChange={(e) => onChange(e.target.value, alt)}
          placeholder={t("presentations.imagePathPlaceholder")}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.imageAlt")}
        </label>
        <Input
          value={alt ?? ""}
          onChange={(e) => onChange(src, e.target.value || undefined)}
          placeholder={t("presentations.imageAltPlaceholder")}
        />
      </div>
    </>
  );
}

function VideoFields({
  slide,
  presentationId,
  onChange,
}: {
  slide: VideoSlideContent;
  presentationId: number;
  onChange: (slide: VideoSlideContent) => void;
}) {
  const { t } = useTranslation();

  const updateMode = (mode: VideoSlideMode) => onChange({ ...slide, mode });

  return (
    <div className="space-y-4">
      <VideoPicker
        presentationId={presentationId}
        value={slide}
        onChange={(next) => onChange(next)}
      />

      <div className="grid grid-cols-2 gap-3">
        <ToggleField
          label={t("presentations.videoAutoPlay")}
          checked={slide.autoPlay}
          onToggle={() => onChange({ ...slide, autoPlay: !slide.autoPlay })}
        />
        <ToggleField
          label={t("presentations.videoLoop")}
          checked={slide.loop}
          onToggle={() => onChange({ ...slide, loop: !slide.loop })}
        />
        <ToggleField
          label={t("presentations.videoMuted")}
          checked={slide.muted}
          onToggle={() => onChange({ ...slide, muted: !slide.muted })}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.videoMode")}
        </label>
        <Select value={slide.mode} onValueChange={(value) => updateMode(value as VideoSlideMode)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fullscreen">{t("presentations.videoModeFullscreen")}</SelectItem>
            <SelectItem value="background">{t("presentations.videoModeBackground")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {slide.mode === "background" && (
        <>
          <div className="flex gap-3">
            <label className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-2">
              {t("presentations.text")}
            </label>
            <textarea
              className={cn(
                "flex min-h-[100px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
              value={slide.text ?? ""}
              onChange={(e) => onChange({ ...slide, text: e.target.value || undefined })}
              placeholder={t("presentations.videoOverlayPlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
                {t("presentations.videoTextColor")}
              </label>
              <Input
                value={slide.textColor ?? "#ffffff"}
                onChange={(e) => onChange({ ...slide, textColor: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
                {t("presentations.videoTextSize")}
              </label>
              <Input
                type="number"
                min={12}
                max={120}
                value={slide.textSize ?? 42}
                onChange={(e) => onChange({ ...slide, textSize: Number(e.target.value) || 42 })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
        checked ? "border-primary bg-primary/10 text-foreground" : "border-border bg-transparent text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className={cn("text-base font-semibold", checked ? "text-primary" : "text-muted-foreground")}>
        {checked ? "●" : "○"}
      </span>
    </button>
  );
}

function defaultVideoSlide(): VideoSlideContent {
  return {
    type: "video",
    videoPath: "",
    autoPlay: true,
    loop: false,
    muted: false,
    mode: "fullscreen",
    text: "",
    textColor: "#ffffff",
    textSize: 42,
  };
}
