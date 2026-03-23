import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../../types/presentation";
import { Input } from "../../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select";
import { cn } from "../../../lib/utils";
import { VideoPicker } from "../video-picker";
import { ToggleField } from "./toggle-field";

export function VideoFields({
  slide,
  presentationId,
  onChange,
}: {
  slide: SlideContent;
  presentationId: number;
  onChange: (slide: SlideContent) => void;
}) {
  const { t } = useTranslation();

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
          checked={slide.autoPlay ?? true}
          onToggle={() => onChange({ ...slide, autoPlay: !slide.autoPlay })}
        />
        <ToggleField
          label={t("presentations.videoLoop")}
          checked={slide.loop ?? false}
          onToggle={() => onChange({ ...slide, loop: !slide.loop })}
        />
        <ToggleField
          label={t("presentations.videoMuted")}
          checked={slide.muted ?? false}
          onToggle={() => onChange({ ...slide, muted: !slide.muted })}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.videoMode")}
        </label>
        <Select value={slide.mode ?? "fullscreen"} onValueChange={(value) => onChange({ ...slide, mode: value })}>
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
              onChange={(e) => onChange({ ...slide, text: e.target.value || null })}
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
