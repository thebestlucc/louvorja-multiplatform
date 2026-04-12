import { useTranslation } from "react-i18next";
import { Monitor, Music, Type } from "lucide-react";
import { cn } from "../../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import {
  useProjectionDisplaySetting,
  useLyricsDisplaySetting,
  FONT_FAMILY_OPTIONS,
  type ProjectionDisplaySettings,
  type LyricsDisplaySettings,
} from "../../lib/use-presentation-font-size";


export function DisplaySection() {
  const { t } = useTranslation();
  const projection = useProjectionDisplaySetting();
  const lyrics = useLyricsDisplaySetting();

  const loaded = projection.loaded && lyrics.loaded;
  if (!loaded) return null;

  const updateProjection = (next: ProjectionDisplaySettings) => projection.update(next);
  const updateLyrics = (next: LyricsDisplaySettings) => lyrics.update(next);

  const ls = lyrics.settings;

  const COLOR_PRESETS = [
    { name: "Classic", textColor: "#ffffff", backgroundColor: "#000000" },
    { name: "Golden",  textColor: "#f5ec00", backgroundColor: "#1a1a2e" },
    { name: "Warm",    textColor: "#fff8e7", backgroundColor: "#1c1008" },
    { name: "Azure",   textColor: "#ffffff", backgroundColor: "#0a192f" },
    { name: "Amber",   textColor: "#f4d03f", backgroundColor: "#2c1810" },
    { name: "Day",     textColor: "#1a1a2e", backgroundColor: "#f0f0f0" },
  ] as const;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("settings.displaySectionTitle")}</h2>
      </div>

      <div className="space-y-6">
        {/* ── Font & Typography ── */}
        <div className="space-y-4 rounded-md border border-border/50 bg-background/50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Type className="h-4 w-4" />
            {t("settings.fontAndTypography")}
          </h3>

          {/* Font size */}
          <div>
            <div className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-muted-foreground">
                {t("settings.presentationFontSize")}
              </span>
              <Slider
                value={[projection.settings.fontSize]}
                onValueChange={([val]) => updateProjection({ ...projection.settings, fontSize: val })}
                min={24}
                max={500}
                step={2}
                className="flex-1"
                aria-label={t("settings.presentationFontSize")}
              />
              <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                {projection.settings.fontSize}px
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.presentationFontSizeHint")}
            </p>
          </div>

          {/* Font family */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium">{t("settings.presentationFontFamily")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.presentationFontFamilyHint")}</p>
            </div>
            <Select
              value={projection.settings.fontFamily}
              onValueChange={(val) => updateProjection({ ...projection.settings, fontFamily: val })}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t("settings.presentationFontFamilyDefault")} />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Lyrics Customization ── */}
        <div className="space-y-4 rounded-md border border-border/50 bg-background/50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Music className="h-4 w-4" />
            {t("settings.lyricsCustomization")}
          </h3>

          {/* Live preview — simulates plain background (no album art), which is the
              most common case. The panel backdrop only appears on the projector
              when a slide has an album art image (panelOpacity controls that). */}
          <div
            className="relative flex h-16 items-center justify-center overflow-hidden rounded-md border border-border/40"
            style={{ backgroundColor: ls.backgroundColor }}
          >
            <span className="text-sm font-semibold" style={{ color: ls.textColor }}>
              Santo, Santo, Santo é o Senhor
            </span>
          </div>

          {/* Predefined color combinations */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">{t("settings.lyricsColorPresets")}</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isActive =
                  ls.textColor.toLowerCase() === preset.textColor.toLowerCase() &&
                  ls.backgroundColor.toLowerCase() === preset.backgroundColor.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    onClick={() => updateLyrics({ ...ls, textColor: preset.textColor, backgroundColor: preset.backgroundColor })}
                    className={cn(
                      "flex h-8 min-w-[52px] cursor-pointer items-center justify-center rounded-md border px-2 text-xs font-semibold transition-all",
                      isActive ? "ring-2 ring-primary ring-offset-1" : "hover:opacity-90",
                    )}
                    style={{ backgroundColor: preset.backgroundColor, color: preset.textColor, borderColor: `${preset.textColor}30` }}
                  >
                    Aa
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color pickers – 2-up grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Text color */}
            <div className="rounded-md border border-border/60 bg-background p-2.5">
              <p className="mb-2 text-xs font-medium">{t("settings.lyricsTextColor")}</p>
              <label className="flex cursor-pointer items-center gap-2" title={t("settings.lyricsTextColorHint")}>
                <div className="relative h-7 w-7 shrink-0 rounded-md border border-border shadow-sm" style={{ backgroundColor: ls.textColor }}>
                  <input
                    type="color"
                    value={ls.textColor}
                    onChange={(e) => updateLyrics({ ...ls, textColor: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {ls.textColor}
                </span>
              </label>
            </div>

            {/* Background color */}
            <div className="rounded-md border border-border/60 bg-background p-2.5">
              <p className="mb-2 text-xs font-medium">{t("settings.lyricsBackgroundColor")}</p>
              <label className="flex cursor-pointer items-center gap-2" title={t("settings.lyricsBackgroundColorHint")}>
                <div className="relative h-7 w-7 shrink-0 rounded-md border border-border shadow-sm" style={{ backgroundColor: ls.backgroundColor }}>
                  <input
                    type="color"
                    value={ls.backgroundColor}
                    onChange={(e) => updateLyrics({ ...ls, backgroundColor: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {ls.backgroundColor}
                </span>
              </label>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1">
            {/* Enable background image */}
            <div className="flex items-center justify-between gap-4 rounded-md px-1 py-2">
              <div>
                <span className="text-sm font-medium">{t("settings.lyricsEnableBgImage")}</span>
                <p className="text-xs text-muted-foreground">{t("settings.lyricsEnableBgImageHint")}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={ls.enableBackgroundImage}
                  onChange={(e) => updateLyrics({ ...ls, enableBackgroundImage: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:start-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
              </label>
            </div>

            {/* Backdrop filter + opacity (nested) */}
            <div className={cn("rounded-md px-1 py-2 transition-opacity", !ls.enableBackgroundImage && "opacity-40 pointer-events-none")}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-medium">{t("settings.lyricsBackdropFilter")}</span>
                  <p className="text-xs text-muted-foreground">{t("settings.lyricsBackdropFilterHint")}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={ls.enableBackdropFilter}
                    onChange={(e) => updateLyrics({ ...ls, enableBackdropFilter: e.target.checked })}
                    className="peer sr-only"
                    disabled={!ls.enableBackgroundImage}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:start-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
                </label>
              </div>

              {/* Backdrop opacity – only when backdrop filter is active */}
              {ls.enableBackdropFilter && ls.enableBackgroundImage && (
                <div className="mt-3 ml-3 border-l-2 border-border pl-3">
                  <div className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm text-muted-foreground">
                      {t("settings.lyricsBackdropOpacity")}
                    </span>
                    <Slider
                      value={[ls.backdropOpacity]}
                      onValueChange={([val]) => updateLyrics({ ...ls, backdropOpacity: val })}
                      min={0}
                      max={100}
                      step={5}
                      className="flex-1"
                      aria-label={t("settings.lyricsBackdropOpacity")}
                    />
                    <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                      {ls.backdropOpacity}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.lyricsBackdropOpacityHint")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel opacity – always visible, separated */}
          <div className="border-t border-border/40 pt-3">
            <div className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-sm font-medium">
                {t("settings.lyricsPanelOpacity")}
              </span>
              <Slider
                value={[ls.panelOpacity]}
                onValueChange={([val]) => updateLyrics({ ...ls, panelOpacity: val })}
                min={0}
                max={100}
                step={5}
                className="flex-1"
                aria-label={t("settings.lyricsPanelOpacity")}
              />
              <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                {ls.panelOpacity}%
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.lyricsPanelOpacityHint")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
