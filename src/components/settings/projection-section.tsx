import { useTranslation } from "react-i18next";
import { Monitor } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import {
  useProjectionDisplaySetting,
  FONT_FAMILY_OPTIONS,
} from "../../lib/use-presentation-font-size";

export function ProjectionSection() {
  const { t } = useTranslation();
  const { settings, update, loaded } = useProjectionDisplaySetting();

  if (!loaded) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("settings.presentationTitle")}</h2>
      </div>

      <div className="space-y-4">
        {/* Font size */}
        <div>
          <div className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm text-muted-foreground">
              {t("settings.presentationFontSize")}
            </span>
            <Slider
              value={[settings.fontSize]}
              onValueChange={([val]) => update({ ...settings, fontSize: val })}
              min={24}
              max={72}
              step={2}
              className="flex-1"
              aria-label={t("settings.presentationFontSize")}
            />
            <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
              {settings.fontSize}px
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
            value={settings.fontFamily}
            onValueChange={(val) => update({ ...settings, fontFamily: val })}
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
    </section>
  );
}
