import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../../lib/bindings";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select";
import { cn } from "../../../lib/utils";
import { VideoPicker } from "../video-picker";
import { ToggleField } from "./toggle-field";

type VideoSlide = Extract<SlideContent, { slideType: "video" }>;

interface VideoFieldsProps {
  slide: VideoSlide;
  onChange: (slide: VideoSlide) => void;
}

export function VideoFields({ slide, onChange }: VideoFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <VideoPicker
        value={slide}
        onChange={(next) => onChange(next as VideoSlide)}
      />

      <div className="grid grid-cols-2 gap-3">
        <ToggleField
          label={t("presentations.videoAutoPlay")}
          checked={slide.auto_play}
          onToggle={() => onChange({ ...slide, auto_play: !slide.auto_play })}
        />
        <ToggleField
          label={t("presentations.videoLoop")}
          checked={slide.loop_video}
          onToggle={() => onChange({ ...slide, loop_video: !slide.loop_video })}
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
        <Select value={slide.mode} onValueChange={(value) => onChange({ ...slide, mode: value as VideoSlide["mode"] })}>
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
              value={slide.overlay_text ?? ""}
              onChange={(e) => onChange({ ...slide, overlay_text: e.target.value || null })}
              placeholder={t("presentations.videoOverlayPlaceholder")}
            />
          </div>
        </>
      )}
    </div>
  );
}
