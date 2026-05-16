import { useTranslation } from "react-i18next";
import { Music } from "lucide-react";
import { Slider } from "../ui/slider";
import {
  useLyricsDisplaySetting,
} from "../../lib/use-presentation-font-size";

export function LyricsDisplaySection() {
  const { t } = useTranslation();
  const { settings, update, loaded } = useLyricsDisplaySetting();

  if (!loaded) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Music className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("settings.lyricsDisplayTitle")}</h2>
      </div>

      <div className="space-y-5">
        {/* Text Color */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="lyrics-text-color" className="text-sm font-medium">{t("settings.lyricsTextColor")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.lyricsTextColorHint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="lyrics-text-color"
              type="color"
              value={settings.textColor}
              onChange={(e) => update({ ...settings, textColor: e.target.value })}
              className="h-8 w-14 cursor-pointer rounded border border-border bg-transparent"
            />
            <span className="w-20 text-sm tabular-nums text-muted-foreground">
              {settings.textColor}
            </span>
          </div>
        </div>

        {/* Background Color */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="lyrics-bg-color" className="text-sm font-medium">{t("settings.lyricsBackgroundColor")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.lyricsBackgroundColorHint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="lyrics-bg-color"
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => update({ ...settings, backgroundColor: e.target.value })}
              className="h-8 w-14 cursor-pointer rounded border border-border bg-transparent"
            />
            <span className="w-20 text-sm tabular-nums text-muted-foreground">
              {settings.backgroundColor}
            </span>
          </div>
        </div>

        {/* Enable Background Image */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("settings.lyricsEnableBgImage")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.lyricsEnableBgImageHint")}</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.enableBackgroundImage}
              onChange={(e) => update({ ...settings, enableBackgroundImage: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:start-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
          </label>
        </div>

        {/* Backdrop Filter */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("settings.lyricsBackdropFilter")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.lyricsBackdropFilterHint")}</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.enableBackdropFilter}
              onChange={(e) => update({ ...settings, enableBackdropFilter: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:start-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
          </label>
        </div>

        {/* Backdrop Opacity */}
        <div>
          <div className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-sm text-muted-foreground">
              {t("settings.lyricsBackdropOpacity")}
            </span>
            <Slider
              value={[settings.backdropOpacity]}
              onValueChange={([val]) => update({ ...settings, backdropOpacity: val })}
              min={0}
              max={100}
              step={5}
              className="flex-1"
              aria-label={t("settings.lyricsBackdropOpacity")}
            />
            <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
              {settings.backdropOpacity}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.lyricsBackdropOpacityHint")}
          </p>
        </div>

        {/* Panel Opacity (dark overlay behind text) */}
        <div>
          <div className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-sm text-muted-foreground">
              {t("settings.lyricsPanelOpacity")}
            </span>
            <Slider
              value={[settings.panelOpacity]}
              onValueChange={([val]) => update({ ...settings, panelOpacity: val })}
              min={0}
              max={100}
              step={5}
              className="flex-1"
              aria-label={t("settings.lyricsPanelOpacity")}
            />
            <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
              {settings.panelOpacity}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.lyricsPanelOpacityHint")}
          </p>
        </div>
      </div>
    </section>
  );
}
