import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { useVideoPlayerStore } from "../../stores/video-player-store";
import { ToggleButton } from "./toggle-button";

export function ExperimentalSection() {
  const { t } = useTranslation();
  const useRustVideoPipeline = useVideoPlayerStore((s) => s.useRustVideoPipeline);
  const setUseRustVideoPipeline = useVideoPlayerStore((s) => s.setUseRustVideoPipeline);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t("settings.experimental.title")}</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("settings.experimental.warning")}</p>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">
              {t("settings.experimental.rustVideoPipeline.label")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("settings.experimental.rustVideoPipeline.description")}
            </p>
          </div>
          <ToggleButton
            checked={useRustVideoPipeline}
            onClick={() => setUseRustVideoPipeline(!useRustVideoPipeline)}
            ariaLabel={t("settings.experimental.rustVideoPipeline.label")}
          />
        </div>
      </section>
    </div>
  );
}
