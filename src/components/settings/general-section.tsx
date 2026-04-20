import { useState, useEffect } from "react";
import { enable as autostartEnable, disable as autostartDisable, isEnabled as autostartIsEnabled } from "@tauri-apps/plugin-autostart";
import { useTranslation } from "react-i18next";
import { Film, Languages, FolderOpen } from "lucide-react";
import { catcher } from "../../lib/catcher";
import { useSetting, useSetSetting } from "../../lib/queries";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { useThemeStore } from "../../stores/theme-store";
import { ToggleButton, isLanguage } from "./toggle-button";

export function GeneralSection() {
  const { t } = useTranslation();
  const { language, setLanguage } = useThemeStore();

  const { data: languageSetting } = useSetting("app.language");
  const { data: ffprobeEnabledSetting } = useSetting("video.ffprobeEnabled");
  const { data: ffprobePathSetting } = useSetting("video.ffprobePath");
  const { data: autoCheckCollectionSetting } = useSetting("collections.autoCheckSourceOnOpen");
  const setSettingMutation = useSetSetting();

  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [ffprobeEnabled, setFfprobeEnabled] = useState(false);
  const [ffprobePath, setFfprobePath] = useState("");
  const [autoCheckCollectionSource, setAutoCheckCollectionSource] = useState(true);

  useEffect(() => {
    if (languageSetting && isLanguage(languageSetting.value)) {
      setLanguage(languageSetting.value);
    }
  }, [languageSetting, setLanguage]);

  useEffect(() => {
    if (ffprobeEnabledSetting) setFfprobeEnabled(ffprobeEnabledSetting.value === "true");
  }, [ffprobeEnabledSetting]);

  useEffect(() => {
    if (ffprobePathSetting) setFfprobePath(ffprobePathSetting.value);
  }, [ffprobePathSetting]);

  useEffect(() => {
    if (autoCheckCollectionSetting) {
      setAutoCheckCollectionSource(autoCheckCollectionSetting.value !== "false");
    }
  }, [autoCheckCollectionSetting]);

  useEffect(() => {
    void (async () => {
      const [isEnabled] = await catcher(autostartIsEnabled(), { notify: false });
      if (isEnabled !== null) setLaunchAtStartup(isEnabled);
    })();
  }, []);

  const handleLanguageChange = (value: string) => {
    if (!isLanguage(value)) return;
    setLanguage(value);
    setSettingMutation.mutate({ key: "app.language", value });
  };

  const handleLaunchAtStartupToggle = async () => {
    await catcher(async () => {
      if (launchAtStartup) {
        await autostartDisable();
        setLaunchAtStartup(false);
      } else {
        await autostartEnable();
        setLaunchAtStartup(true);
      }
    }, { notify: true });
  };

  const handleFfprobeEnabledChange = (checked: boolean) => {
    setFfprobeEnabled(checked);
    setSettingMutation.mutate({ key: "video.ffprobeEnabled", value: String(checked) });
  };

  const handleFfprobePathBlur = () => {
    setSettingMutation.mutate({ key: "video.ffprobePath", value: ffprobePath.trim() });
  };

  const handleAutoCheckCollectionSourceChange = (checked: boolean) => {
    setAutoCheckCollectionSource(checked);
    setSettingMutation.mutate({
      key: "collections.autoCheckSourceOnOpen",
      value: String(checked),
    });
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2">
            <Languages className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <label className="text-sm font-medium">{t("settings.language")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
            </div>
          </div>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt">{t("settings.languagePt")}</SelectItem>
              <SelectItem value="en">{t("settings.languageEn")}</SelectItem>
              <SelectItem value="es">{t("settings.languageEs")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Launch at Startup */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t("settings.launchAtStartup")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.launchAtStartupDesc")}</p>
          </div>
          <Button
            variant={launchAtStartup ? "default" : "outline"}
            size="sm"
            onClick={() => handleLaunchAtStartupToggle()}
          >
            {launchAtStartup ? t("settings.autoStartOn") : t("settings.autoStartOff")}
          </Button>
        </div>
      </section>

      {/* Video / ffprobe */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.video")}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium">{t("settings.ffprobeEnabled")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.ffprobeEnabledDesc")}</p>
            </div>
            <ToggleButton
              checked={ffprobeEnabled}
              onClick={() => handleFfprobeEnabledChange(!ffprobeEnabled)}
              ariaLabel={t("settings.ffprobeEnabled")}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <label className="text-sm font-medium">{t("settings.ffprobePath")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.ffprobePathDesc")}</p>
            </div>
            <Input
              value={ffprobePath}
              onChange={(e) => setFfprobePath(e.target.value)}
              onBlur={handleFfprobePathBlur}
              placeholder={t("settings.ffprobePathPlaceholder")}
              className="w-72"
            />
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.collections")}</h2>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("settings.collectionsAutoCheck")}</label>
            <p className="text-xs text-muted-foreground">
              {t("settings.collectionsAutoCheckDesc")}
            </p>
          </div>
          <ToggleButton
            checked={autoCheckCollectionSource}
            onClick={() => handleAutoCheckCollectionSourceChange(!autoCheckCollectionSource)}
            ariaLabel={t("settings.collectionsAutoCheck")}
          />
        </div>
      </section>

    </div>
  );
}
