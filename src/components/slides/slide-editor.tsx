import { useTranslation } from "react-i18next";
import type { SlideContent, SlideType } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { cn } from "../../lib/utils";

interface SlideEditorProps {
  slide: SlideContent;
  onChange: (content: SlideContent) => void;
}

const SLIDE_TYPES: SlideType[] = ["cover", "lyrics", "pause", "text", "image"];

export function SlideEditor({ slide, onChange }: SlideEditorProps) {
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
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Preview */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="aspect-video overflow-hidden rounded-lg border border-border">
          <SlideRenderer slide={slide} className="h-full w-full" />
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
