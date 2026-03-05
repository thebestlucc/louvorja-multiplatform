import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { enable as autostartEnable, disable as autostartDisable, isEnabled as autostartIsEnabled } from "@tauri-apps/plugin-autostart";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { Wifi, Palette, Languages, Film, FolderOpen, Monitor, Upload, X, Cloud, Trash2, Sliders, Keyboard, Database } from "lucide-react";
import {
  useCancelLegacyFetch,
  useClearDatabase,
  useCopyImageToMedia,
  useFetchLegacyParams,
  useLegacyFetchProgress,
  useLegacyFetchReport,
  useMonitorConfigs,
  useMonitors,
  useSaveMonitorConfig,
  useSetting,
  useSetSetting,
  useStartLegacyFetch,
} from "../../lib/queries";
import { LegacyFetchWizard, LegacyFetchProgressCard } from "../../components/migration/legacy-fetch-wizard";
import { useLegacyFetchStore } from "../../stores/legacy-fetch-store";
import type {
  LegacyFetchOptions,
  MonitorConfig,
} from "../../lib/bindings";
import { StreamingControls } from "../../components/streaming/streaming-controls";
import { ShortcutsTab } from "../../components/settings/shortcuts-tab";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { useThemeStore } from "../../stores/theme-store";
import { LANGUAGES, THEMES, type Language, type Theme } from "../../lib/constants";
import {
  PROJECTOR_LOGO_IMAGE_PATH_KEY,
  PROJECTOR_SCREEN_CONTENT_TYPE_KEY,
  PROJECTOR_SCREEN_MEDIA_PATH_KEY,
  PROJECTOR_SCREEN_TEXT_KEY,
  type ProjectorScreenDefaultContentType,
  isProjectorScreenDefaultContentType,
} from "../../lib/projector-screen-defaults";
import { useMediaSource } from "../../hooks/use-media-source";
import { closeProjectorWindow, closeReturnWindow, openProjectorWindow, openReturnWindow } from "../../lib/tauri";
import { resolveProjectionMonitorIndexes } from "../../lib/monitor-resolution";
import { getPreferredMonitorName } from "../../lib/monitor-display-name";

type SettingsTab = "general" | "appearance" | "shortcuts" | "monitor" | "streaming" | "migration" | "data";

interface SettingsSearch {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/settings/")({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      tab: search.tab as SettingsTab | undefined,
    };
  },
  component: SettingsIndex,
});

const SETTINGS_TABS: { id: SettingsTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: Sliders },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
  { id: "shortcuts", labelKey: "settings.tabs.shortcuts", icon: Keyboard },
  { id: "monitor", labelKey: "settings.tabs.monitor", icon: Monitor },
  { id: "streaming", labelKey: "settings.tabs.streaming", icon: Wifi },
  { id: "migration", labelKey: "settings.tabs.migration", icon: Upload },
  { id: "data", labelKey: "settings.tabs.data", icon: Database },
];

function SettingsIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeTab = search.tab ?? "general";

  const setActiveTab = (tab: SettingsTab) => {
    navigate({
      to: "/settings",
      search: { tab },
      replace: true,
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      <nav className="w-52 flex-shrink-0 border-r border-border bg-surface p-3">
        <h1 className="mb-3 px-3 text-lg font-semibold">{t("nav.settings")}</h1>
        <ul className="space-y-1">
          {SETTINGS_TABS.map(({ id, labelKey, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  activeTab === id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {t(labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === "general" && <GeneralSection />}
        {activeTab === "appearance" && <AppearanceSection />}
        {activeTab === "shortcuts" && <ShortcutsTab />}
        {activeTab === "monitor" && <MonitorSection />}
        {activeTab === "streaming" && <StreamingSection />}
        {activeTab === "migration" && <MigrationSection />}
        {activeTab === "data" && <DataSection />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GeneralSection                                                     */
/* ------------------------------------------------------------------ */

function GeneralSection() {
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
            onClick={() => void handleLaunchAtStartupToggle()}
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

/* ------------------------------------------------------------------ */
/*  AppearanceSection                                                  */
/* ------------------------------------------------------------------ */

function AppearanceSection() {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  const { data: themeSetting } = useSetting("app.theme");
  const { data: projectorScreenDefaultContentTypeSetting } = useSetting(PROJECTOR_SCREEN_CONTENT_TYPE_KEY);
  const { data: projectorScreenDefaultTextSetting } = useSetting(PROJECTOR_SCREEN_TEXT_KEY);
  const { data: projectorScreenDefaultMediaPathSetting } = useSetting(PROJECTOR_SCREEN_MEDIA_PATH_KEY);
  const { data: projectorLogoImagePathSetting } = useSetting(PROJECTOR_LOGO_IMAGE_PATH_KEY);
  const setSettingMutation = useSetSetting();
  const copyImageMutation = useCopyImageToMedia();

  const [projectorScreenDefaultContentType, setProjectorScreenDefaultContentType] =
    useState<ProjectorScreenDefaultContentType>("logo");
  const [projectorScreenDefaultText, setProjectorScreenDefaultText] = useState("LouvorJA");
  const [projectorScreenDefaultMediaPath, setProjectorScreenDefaultMediaPath] = useState("");
  const [projectorLogoImagePath, setProjectorLogoImagePath] = useState("");

  const projectorLogoPreviewSrc = useMediaSource(projectorLogoImagePath);

  useEffect(() => {
    if (themeSetting && isTheme(themeSetting.value)) {
      setTheme(themeSetting.value);
    }
  }, [setTheme, themeSetting]);

  useEffect(() => {
    if (!projectorScreenDefaultContentTypeSetting) return;
    if (!isProjectorScreenDefaultContentType(projectorScreenDefaultContentTypeSetting.value)) return;
    setProjectorScreenDefaultContentType(projectorScreenDefaultContentTypeSetting.value);
  }, [projectorScreenDefaultContentTypeSetting]);

  useEffect(() => {
    if (projectorScreenDefaultTextSetting) {
      setProjectorScreenDefaultText(projectorScreenDefaultTextSetting.value || "LouvorJA");
    }
  }, [projectorScreenDefaultTextSetting]);

  useEffect(() => {
    if (projectorScreenDefaultMediaPathSetting) {
      setProjectorScreenDefaultMediaPath(projectorScreenDefaultMediaPathSetting.value);
    }
  }, [projectorScreenDefaultMediaPathSetting]);

  useEffect(() => {
    if (projectorLogoImagePathSetting) {
      setProjectorLogoImagePath(projectorLogoImagePathSetting.value);
    }
  }, [projectorLogoImagePathSetting]);

  const handleThemeChange = (value: string) => {
    if (!isTheme(value)) return;
    setTheme(value);
    setSettingMutation.mutate({ key: "app.theme", value });
  };

  const handleProjectorScreenDefaultContentTypeChange = (value: string) => {
    if (!isProjectorScreenDefaultContentType(value)) return;
    setProjectorScreenDefaultContentType(value);
    setSettingMutation.mutate({ key: PROJECTOR_SCREEN_CONTENT_TYPE_KEY, value });
  };

  const handleProjectorScreenDefaultTextBlur = () => {
    setSettingMutation.mutate({
      key: PROJECTOR_SCREEN_TEXT_KEY,
      value: projectorScreenDefaultText.trim() || "LouvorJA",
    });
  };

  const persistProjectorDefaultMediaPath = (value: string) => {
    const normalized = value.trim();
    setProjectorScreenDefaultMediaPath(normalized);
    setSettingMutation.mutate({
      key: PROJECTOR_SCREEN_MEDIA_PATH_KEY,
      value: normalized,
    });
  };

  const handlePickProjectorDefaultImage = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    const [managedPath] = await catcher(copyImageMutation.mutateAsync(selected), { notify: true });
    if (managedPath) {
      persistProjectorDefaultMediaPath(managedPath);
      notify.success(t("settings.projectorMediaUpdated"));
    }
  };

  const handlePickProjectorDefaultVideo = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4", "webm"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    persistProjectorDefaultMediaPath(selected);
    notify.success(t("settings.projectorMediaUpdated"));
  };

  const handleClearProjectorDefaultMediaPath = () => {
    persistProjectorDefaultMediaPath("");
  };

  const persistProjectorLogoImagePath = (value: string) => {
    const normalized = value.trim();
    setProjectorLogoImagePath(normalized);
    setSettingMutation.mutate({
      key: PROJECTOR_LOGO_IMAGE_PATH_KEY,
      value: normalized,
    });
  };

  const handlePickProjectorLogoImage = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    const [managedPath] = await catcher(copyImageMutation.mutateAsync(selected), { notify: true });
    if (managedPath) {
      persistProjectorLogoImagePath(managedPath);
      notify.success(t("settings.projectorLogoUpdated"));
    }
  };

  const handleClearProjectorLogoImage = () => {
    persistProjectorLogoImagePath("");
  };

  return (
    <div className="space-y-6">
      {/* Theme */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.appearance")}</h2>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("settings.theme")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.themeDesc")}</p>
          </div>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`themes.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Projector Screens Defaults */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.projectorScreens")}</h2>
        </div>

        <div className="space-y-5">
          {/* Logo screen image */}
          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <label className="text-sm font-medium">{t("settings.projectorLogoScreen")}</label>
                <p className="text-xs text-muted-foreground">{t("settings.projectorLogoScreenDesc")}</p>
              </div>
              <div className="flex h-20 w-36 items-center justify-center overflow-hidden rounded-md border border-border bg-black/90">
                {projectorLogoPreviewSrc ? (
                  <img
                    src={projectorLogoPreviewSrc}
                    alt={t("settings.projectorDefaultContentLogo")}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-sm font-semibold text-white/70">LouvorJA</span>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Input
                readOnly
                value={projectorLogoImagePath}
                placeholder={t("settings.projectorLogoImagePlaceholder")}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handlePickProjectorLogoImage()}
                disabled={copyImageMutation.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("settings.projectorLogoSelect")}
              </Button>
              {projectorLogoImagePath && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearProjectorLogoImage}
                >
                  <X className="mr-2 h-4 w-4" />
                  {t("settings.projectorLogoClear")}
                </Button>
              )}
            </div>
          </div>

          {/* Default content type */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium">{t("settings.projectorDefaultContent")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.projectorDefaultContentDesc")}</p>
            </div>
            <Select
              value={projectorScreenDefaultContentType}
              onValueChange={handleProjectorScreenDefaultContentTypeChange}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="logo">{t("settings.projectorDefaultContentLogo")}</SelectItem>
                <SelectItem value="text">{t("settings.projectorDefaultContentText")}</SelectItem>
                <SelectItem value="image">{t("settings.projectorDefaultContentImage")}</SelectItem>
                <SelectItem value="video">{t("settings.projectorDefaultContentVideo")}</SelectItem>
                <SelectItem value="clock">{t("settings.projectorDefaultContentClock")}</SelectItem>
                <SelectItem value="timer">{t("settings.projectorDefaultContentTimer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {projectorScreenDefaultContentType === "text" && (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <label className="text-sm font-medium">{t("settings.projectorDefaultText")}</label>
                <p className="text-xs text-muted-foreground">{t("settings.projectorDefaultTextDesc")}</p>
              </div>
              <Input
                value={projectorScreenDefaultText}
                onChange={(e) => setProjectorScreenDefaultText(e.target.value)}
                onBlur={handleProjectorScreenDefaultTextBlur}
                placeholder={t("settings.projectorDefaultTextPlaceholder")}
                className="w-72"
              />
            </div>
          )}

          {(projectorScreenDefaultContentType === "image" ||
            projectorScreenDefaultContentType === "video") && (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <label className="text-sm font-medium">{t("settings.projectorDefaultMediaPath")}</label>
                <p className="text-xs text-muted-foreground">{t("settings.projectorDefaultMediaPathDesc")}</p>
              </div>
              <div className="flex w-md items-center gap-2">
                <Input
                  readOnly
                  value={projectorScreenDefaultMediaPath}
                  placeholder={projectorScreenDefaultContentType === "image"
                    ? t("settings.projectorDefaultImagePlaceholder")
                    : t("settings.projectorDefaultVideoPlaceholder")}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void (projectorScreenDefaultContentType === "image"
                      ? handlePickProjectorDefaultImage()
                      : handlePickProjectorDefaultVideo())}
                  disabled={copyImageMutation.isPending}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {t("settings.projectorDefaultSelectFile")}
                </Button>
                {projectorScreenDefaultMediaPath && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleClearProjectorDefaultMediaPath}
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t("settings.projectorDefaultClearFile")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MonitorSection                                                     */
/* ------------------------------------------------------------------ */

function MonitorSection() {
  const { t } = useTranslation();

  const { data: monitors = [] } = useMonitors();
  const { data: monitorConfigs = [] } = useMonitorConfigs();
  const saveMonitorConfigMutation = useSaveMonitorConfig();

  const [projectorMonitorId, setProjectorMonitorId] = useState("");
  const [returnMonitorId, setReturnMonitorId] = useState("");
  const [monitorFeedback, setMonitorFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testingMonitorRole, setTestingMonitorRole] = useState<"projector" | "return" | null>(null);

  const monitorOptions = useMemo(
    () =>
      monitors.map((monitor, index) => ({
        id: monitor.id,
        name: getPreferredMonitorName(monitor, index),
        resolution: `${monitor.width}x${monitor.height}`,
        isPrimary: monitor.isPrimary,
        connectionType: monitor.connectionType ?? "unknown",
      })),
    [monitors],
  );

  const getConnectionTypeLabel = (connectionType: "integrated" | "external" | "unknown") => {
    switch (connectionType) {
      case "integrated":
        return t("settings.monitorConnectionIntegrated");
      case "external":
        return t("settings.monitorConnectionExternal");
      default:
        return t("settings.monitorConnectionUnknown");
    }
  };

  useEffect(() => {
    if (monitorOptions.length === 0) {
      setProjectorMonitorId("");
      setReturnMonitorId("");
      return;
    }

    const existingProjector = monitorConfigs.find((config) => config.role === "projector")?.monitorId;
    const existingReturn = monitorConfigs.find((config) => config.role === "return")?.monitorId;
    const existingProjectorValid = existingProjector && monitorOptions.some((option) => option.id === existingProjector)
      ? existingProjector
      : undefined;
    const existingReturnValid = existingReturn && monitorOptions.some((option) => option.id === existingReturn)
      ? existingReturn
      : undefined;
    const fallbackIndexes = resolveProjectionMonitorIndexes(monitors, []);
    const fallbackProjector = fallbackIndexes
      ? (monitors[fallbackIndexes.projectorIndex]?.id ?? monitorOptions[0]?.id ?? "")
      : (monitorOptions[0]?.id ?? "");
    const fallbackReturn = fallbackIndexes
      ? (monitors[fallbackIndexes.returnIndex]?.id
        ?? monitorOptions.find((option) => option.id !== fallbackProjector)?.id
        ?? fallbackProjector)
      : (monitorOptions.find((option) => option.id !== fallbackProjector)?.id ?? fallbackProjector);

    setProjectorMonitorId(existingProjectorValid ?? fallbackProjector);
    setReturnMonitorId(existingReturnValid ?? fallbackReturn);
  }, [monitorConfigs, monitorOptions, monitors]);

  const monitorSelectionConfigs = useMemo<MonitorConfig[]>(() => {
    const configs: MonitorConfig[] = [];
    if (projectorMonitorId) {
      configs.push({ id: 0, monitorId: projectorMonitorId, role: "projector", enabled: true });
    }
    if (returnMonitorId) {
      configs.push({ id: 0, monitorId: returnMonitorId, role: "return", enabled: true });
    }
    return configs;
  }, [projectorMonitorId, returnMonitorId]);

  const resolvedMonitorIndexes = useMemo(
    () => resolveProjectionMonitorIndexes(monitors, monitorSelectionConfigs),
    [monitorSelectionConfigs, monitors],
  );
  const projectorMonitorIndex = resolvedMonitorIndexes?.projectorIndex;
  const returnMonitorIndex = resolvedMonitorIndexes?.returnIndex;
  const projectorResolvedMonitorId = projectorMonitorIndex != null ? monitors[projectorMonitorIndex]?.id : undefined;
  const returnResolvedMonitorId = returnMonitorIndex != null ? monitors[returnMonitorIndex]?.id : undefined;
  const hasMonitorOptions = monitorOptions.length > 0;
  const hasMonitorSelectionConflict = monitorOptions.length > 1
    && projectorMonitorId.length > 0
    && returnMonitorId.length > 0
    && projectorMonitorId === returnMonitorId;
  const canSaveMonitorAssignments = hasMonitorOptions
    && projectorMonitorId.length > 0
    && returnMonitorId.length > 0
    && !hasMonitorSelectionConflict
    && !saveMonitorConfigMutation.isPending;

  const handleSaveMonitorAssignments = async () => {
    if (hasMonitorSelectionConflict) {
      const message = t("settings.monitorAssignmentDistinctRequired");
      setMonitorFeedback({ type: "error", message });
      notify.error(message);
      return;
    }
    if (!canSaveMonitorAssignments) return;
    setMonitorFeedback(null);

    const [_, error] = await catcher(async () => {
      await saveMonitorConfigMutation.mutateAsync({ monitorId: projectorMonitorId, role: "projector" });
      await saveMonitorConfigMutation.mutateAsync({ monitorId: returnMonitorId, role: "return" });
    }, { notify: false });

    if (error) {
      const message = t("settings.monitorAssignmentSaveFailed", { error: error.message });
      setMonitorFeedback({ type: "error", message });
      notify.error(message);
    } else {
      const successMessage = t("settings.monitorAssignmentSaved");
      setMonitorFeedback({ type: "success", message: successMessage });
      notify.success(successMessage);
    }
  };

  const openMonitorWindowTemporarily = async (role: "projector" | "return") => {
    const monitorId = role === "projector" ? projectorResolvedMonitorId : returnResolvedMonitorId;
    if (!monitorId) return;
    setTestingMonitorRole(role);

    const [_, error] = await catcher(async () => {
      if (role === "projector") {
        await openProjectorWindow(monitorId);
        window.setTimeout(() => { void closeProjectorWindow(); }, 2500);
      } else {
        await openReturnWindow(monitorId);
        window.setTimeout(() => { void closeReturnWindow(); }, 2500);
      }
      window.setTimeout(() => {
        setTestingMonitorRole((currentRole) => currentRole === role ? null : currentRole);
      }, 2600);
    }, { notify: false });

    if (error) {
      setTestingMonitorRole((currentRole) => currentRole === role ? null : currentRole);
      notify.error(t("settings.monitorAssignmentTestFailed", { error: error.message }));
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("settings.monitorAssignmentTitle")}</h2>
      </div>

      <div className="space-y-5">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">{t("settings.monitorAssignmentTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("settings.monitorAssignmentDesc")}</p>
            </div>

            {hasMonitorOptions ? (
              <>
                <div className="space-y-2">
                  {monitorOptions.map((option) => (
                    <div key={option.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{option.name}</span>
                        <span className="text-xs text-muted-foreground">{option.resolution}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {option.isPrimary ? (
                          <span className="inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {t("settings.monitorAssignmentPrimary")}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                            option.connectionType === "integrated"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : option.connectionType === "external"
                              ? "bg-sky-500/15 text-sky-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {getConnectionTypeLabel(option.connectionType as any)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">{t("settings.monitorAssignmentProjector")}</span>
                    <Select
                      value={projectorMonitorId}
                      onValueChange={(value) => {
                        setProjectorMonitorId(value);
                        setMonitorFeedback(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monitorOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} ({option.resolution}) • {getConnectionTypeLabel(option.connectionType as any)}
                            {option.isPrimary ? ` • ${t("settings.monitorAssignmentPrimary")}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">{t("settings.monitorAssignmentReturn")}</span>
                    <Select
                      value={returnMonitorId}
                      onValueChange={(value) => {
                        setReturnMonitorId(value);
                        setMonitorFeedback(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monitorOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} ({option.resolution}) • {getConnectionTypeLabel(option.connectionType as any)}
                            {option.isPrimary ? ` • ${t("settings.monitorAssignmentPrimary")}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openMonitorWindowTemporarily("projector")}
                    disabled={projectorResolvedMonitorId == null || testingMonitorRole !== null}
                  >
                    {testingMonitorRole === "projector"
                      ? t("settings.monitorAssignmentTesting")
                      : t("settings.monitorAssignmentTestProjector")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openMonitorWindowTemporarily("return")}
                    disabled={returnResolvedMonitorId == null || hasMonitorSelectionConflict || testingMonitorRole !== null}
                  >
                    {testingMonitorRole === "return"
                      ? t("settings.monitorAssignmentTesting")
                      : t("settings.monitorAssignmentTestReturn")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveMonitorAssignments()}
                    disabled={!canSaveMonitorAssignments}
                  >
                    {saveMonitorConfigMutation.isPending
                      ? t("settings.monitorAssignmentSaving")
                      : t("settings.monitorAssignmentSave")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("settings.monitorAssignmentNone")}</p>
            )}

            {monitorFeedback ? (
              <p
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  monitorFeedback.type === "success"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-destructive/40 bg-destructive/10 text-destructive-foreground",
                )}
              >
                {monitorFeedback.message}
              </p>
            ) : null}

            {hasMonitorSelectionConflict ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                {t("settings.monitorAssignmentDistinctRequired")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  StreamingSection                                                   */
/* ------------------------------------------------------------------ */

function StreamingSection() {
  const { t } = useTranslation();

  const { data: portSetting } = useSetting("streaming.port");
  const { data: autoStartSetting } = useSetting("streaming.autoStart");
  const setSettingMutation = useSetSetting();

  const [port, setPort] = useState("7070");
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (portSetting) setPort(portSetting.value);
  }, [portSetting]);

  useEffect(() => {
    if (autoStartSetting) setAutoStart(autoStartSetting.value === "true");
  }, [autoStartSetting]);

  const handlePortBlur = () => {
    const portNum = parseInt(port, 10);
    if (portNum >= 1024 && portNum <= 65535) {
      setSettingMutation.mutate({ key: "streaming.port", value: port });
    }
  };

  const handleAutoStartChange = (checked: boolean) => {
    setAutoStart(checked);
    setSettingMutation.mutate({ key: "streaming.autoStart", value: String(checked) });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Wifi className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("streaming.title")}</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium">{t("settings.defaultPort")}</label>
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            onBlur={handlePortBlur}
            className="w-28"
            min={1024}
            max={65535}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-sm font-medium">{t("settings.autoStart")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.autoStartDesc")}</p>
          </div>
          <ToggleButton
            checked={autoStart}
            onClick={() => handleAutoStartChange(!autoStart)}
            ariaLabel={t("settings.autoStart")}
          />
        </div>

        <hr className="border-border" />

        <StreamingControls />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  MigrationSection                                                   */
/* ------------------------------------------------------------------ */

function MigrationSection() {
  const { t } = useTranslation();

  const legacyFetchRunId = useLegacyFetchStore((s) => s.runId);
  const setLegacyFetchRunId = useLegacyFetchStore((s) => s.setRunId);
  const legacyFetchStoreProgress = useLegacyFetchStore((s) => s.progress);
  const legacyFetchStoreReport = useLegacyFetchStore((s) => s.report);
  const legacyFetchCancelling = useLegacyFetchStore((s) => s.isCancelling);
  const setLegacyFetchCancelling = useLegacyFetchStore((s) => s.setIsCancelling);
  const resetLegacyFetch = useLegacyFetchStore((s) => s.reset);
  const startLegacyFetchMutation = useStartLegacyFetch();
  const cancelLegacyFetchMutation = useCancelLegacyFetch();
  const legacyFetchProgressQuery = useLegacyFetchProgress(legacyFetchRunId, { enabled: Boolean(legacyFetchRunId) });
  const legacyFetchShouldLoadReport = Boolean(
    legacyFetchRunId
      && legacyFetchProgressQuery.data
      && !["pending", "fetching", "importing", "downloading"].includes(legacyFetchProgressQuery.data.status),
  );
  const legacyFetchReportQuery = useLegacyFetchReport(legacyFetchRunId, { enabled: legacyFetchShouldLoadReport });
  const legacyFetchProgress = legacyFetchStoreProgress ?? legacyFetchProgressQuery.data;
  const legacyFetchReport = legacyFetchStoreReport ?? legacyFetchReportQuery.data;
  const legacyFetchIsRunning = legacyFetchProgress
    && ["pending", "fetching", "importing", "downloading"].includes(legacyFetchProgress.status);
  const legacyFetchShowProgress = Boolean(legacyFetchRunId && (legacyFetchIsRunning || legacyFetchProgress || legacyFetchReport));
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "failed">("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const fetchLegacyParamsMutation = useFetchLegacyParams({ enabled: false });

  const handleTestConnection = async () => {
    setConnectionStatus("connecting");
    setConnectionError(null);
    const [_, error] = await catcher(fetchLegacyParamsMutation.refetch(), { notify: false });
    if (error) {
      setConnectionStatus("failed");
      setConnectionError(error.message);
    } else {
      setConnectionStatus("connected");
    }
  };

  const handleStartLegacyFetch = async (options: LegacyFetchOptions) => {
    setConnectionError(null);
    const [runId, error] = await catcher(startLegacyFetchMutation.mutateAsync(options), { notify: false });
    if (error) {
      setConnectionError(error.message);
    } else if (runId) {
      setLegacyFetchRunId(runId);
    }
  };

  const handleCancelLegacyFetch = () => {
    if (!legacyFetchRunId) return;
    setLegacyFetchCancelling(true);
    cancelLegacyFetchMutation.mutate(legacyFetchRunId, {
      onError: () => setLegacyFetchCancelling(false),
    });
  };

  const handleLegacyFetchDone = () => {
    resetLegacyFetch();
  };

  const handleLegacyFetchRetry = () => {
    resetLegacyFetch();
    setConnectionError(null);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Cloud className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("settings.legacyFetch.title")}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("settings.legacyFetch.description")}</p>

      {!legacyFetchShowProgress ? (
        <LegacyFetchWizard
          onStartFetch={handleStartLegacyFetch}
          loading={startLegacyFetchMutation.isPending}
          connectionStatus={connectionStatus}
          connectionError={connectionError}
          onTestConnection={handleTestConnection}
        />
      ) : (
        <LegacyFetchProgressCard
          progress={legacyFetchProgress ?? null}
          report={legacyFetchReport ?? null}
          cancelling={legacyFetchCancelling}
          onCancel={handleCancelLegacyFetch}
          onDone={handleLegacyFetchDone}
          onRetry={handleLegacyFetchRetry}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DataSection                                                        */
/* ------------------------------------------------------------------ */

function DataSection() {
  const { t } = useTranslation();
  const clearDatabaseMutation = useClearDatabase();
  const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);

  const handleClearDatabase = async () => {
    const [_, error] = await catcher(clearDatabaseMutation.mutateAsync(), {
      notify: true,
      fallbackMessage: t("settings.dangerZone.clearDatabaseError", { error: "" }),
    });

    if (error) {
      // Notification handled by catcher
    } else {
      setShowClearDbConfirm(false);
      notify.success(t("settings.dangerZone.clearDatabaseSuccess"));
    }
  };

  return (
    <>
      <section className="rounded-lg border border-destructive/50 bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-medium text-destructive">{t("settings.dangerZone.title")}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <label className="text-sm font-medium">{t("settings.dangerZone.clearDatabase")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.dangerZone.clearDatabaseDesc")}</p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setShowClearDbConfirm(true)}
              disabled={clearDatabaseMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("settings.dangerZone.clearDatabaseButton")}
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={showClearDbConfirm} onOpenChange={setShowClearDbConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.dangerZone.clearDatabaseConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.dangerZone.clearDatabaseConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDbConfirm(false)}
              disabled={clearDatabaseMutation.isPending}
            >
              {t("settings.dangerZone.clearDatabaseCancelButton")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleClearDatabase()}
              disabled={clearDatabaseMutation.isPending}
            >
              {clearDatabaseMutation.isPending ? "..." : t("settings.dangerZone.clearDatabaseConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function ToggleButton({
  checked,
  onClick,
  ariaLabel,
}: {
  checked: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function isTheme(value: string): value is Theme {
  return THEMES.includes(value as Theme);
}

function isLanguage(value: string): value is Language {
  return LANGUAGES.includes(value as Language);
}
