import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Wifi, Palette, Languages, Film, FolderOpen, Monitor, Upload, X } from "lucide-react";
import { useCopyImageToMedia, useSetting, useSetSetting } from "../../lib/queries";
import { StreamingControls } from "../../components/streaming/streaming-controls";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
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

export const Route = createFileRoute("/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { t } = useTranslation();
  const { theme, language, setTheme, setLanguage } = useThemeStore();

  const { data: themeSetting } = useSetting("app.theme");
  const { data: languageSetting } = useSetting("app.language");
  const { data: portSetting } = useSetting("streaming.port");
  const { data: autoStartSetting } = useSetting("streaming.autoStart");
  const { data: ffprobeEnabledSetting } = useSetting("video.ffprobeEnabled");
  const { data: ffprobePathSetting } = useSetting("video.ffprobePath");
  const { data: autoCheckCollectionSetting } = useSetting("collections.autoCheckSourceOnOpen");
  const { data: projectorScreenDefaultContentTypeSetting } = useSetting(PROJECTOR_SCREEN_CONTENT_TYPE_KEY);
  const { data: projectorScreenDefaultTextSetting } = useSetting(PROJECTOR_SCREEN_TEXT_KEY);
  const { data: projectorScreenDefaultMediaPathSetting } = useSetting(PROJECTOR_SCREEN_MEDIA_PATH_KEY);
  const { data: projectorLogoImagePathSetting } = useSetting(PROJECTOR_LOGO_IMAGE_PATH_KEY);
  const setSettingMutation = useSetSetting();
  const copyImageMutation = useCopyImageToMedia();

  const [port, setPort] = useState("7070");
  const [autoStart, setAutoStart] = useState(false);
  const [ffprobeEnabled, setFfprobeEnabled] = useState(false);
  const [ffprobePath, setFfprobePath] = useState("");
  const [autoCheckCollectionSource, setAutoCheckCollectionSource] = useState(true);
  const [projectorScreenDefaultContentType, setProjectorScreenDefaultContentType] =
    useState<ProjectorScreenDefaultContentType>("logo");
  const [projectorScreenDefaultText, setProjectorScreenDefaultText] = useState("LouvorJA");
  const [projectorScreenDefaultMediaPath, setProjectorScreenDefaultMediaPath] = useState("");
  const [projectorLogoImagePath, setProjectorLogoImagePath] = useState("");
  const projectorLogoPreviewSrc = useMediaSource(projectorLogoImagePath);

  useEffect(() => {
    if (portSetting) setPort(portSetting.value);
  }, [portSetting]);

  useEffect(() => {
    if (autoStartSetting) setAutoStart(autoStartSetting.value === "true");
  }, [autoStartSetting]);

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
    if (!projectorScreenDefaultContentTypeSetting) {
      return;
    }
    if (!isProjectorScreenDefaultContentType(projectorScreenDefaultContentTypeSetting.value)) {
      return;
    }
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

  useEffect(() => {
    if (themeSetting && isTheme(themeSetting.value)) {
      setTheme(themeSetting.value);
    }
  }, [setTheme, themeSetting]);

  useEffect(() => {
    if (languageSetting && isLanguage(languageSetting.value)) {
      setLanguage(languageSetting.value);
    }
  }, [languageSetting, setLanguage]);

  const handlePortBlur = () => {
    const portNum = parseInt(port, 10);
    if (portNum >= 1024 && portNum <= 65535) {
      setSettingMutation.mutate({ key: "streaming.port", value: port });
    }
  };

  const handleThemeChange = (value: string) => {
    if (!isTheme(value)) return;
    setTheme(value);
    setSettingMutation.mutate({ key: "app.theme", value });
  };

  const handleLanguageChange = (value: string) => {
    if (!isLanguage(value)) return;
    setLanguage(value);
    setSettingMutation.mutate({ key: "app.language", value });
  };

  const handleAutoStartChange = (checked: boolean) => {
    setAutoStart(checked);
    setSettingMutation.mutate({ key: "streaming.autoStart", value: String(checked) });
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

  const handleProjectorScreenDefaultContentTypeChange = (value: string) => {
    if (!isProjectorScreenDefaultContentType(value)) {
      return;
    }
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

    if (!selected || Array.isArray(selected)) {
      return;
    }

    try {
      const managedPath = await copyImageMutation.mutateAsync(selected);
      persistProjectorDefaultMediaPath(managedPath);
      toast.success(t("settings.projectorMediaUpdated"));
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handlePickProjectorDefaultVideo = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4", "webm"] }],
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    persistProjectorDefaultMediaPath(selected);
    toast.success(t("settings.projectorMediaUpdated"));
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

    if (!selected || Array.isArray(selected)) {
      return;
    }

    try {
      const managedPath = await copyImageMutation.mutateAsync(selected);
      persistProjectorLogoImagePath(managedPath);
      toast.success(t("settings.projectorLogoUpdated"));
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleClearProjectorLogoImage = () => {
    persistProjectorLogoImagePath("");
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <h1 className="text-xl font-semibold">{t("nav.settings")}</h1>

      {/* Appearance Section */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.appearance")}</h2>
        </div>

        <div className="space-y-4">
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
        </div>
      </section>

      {/* Streaming Section */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("streaming.title")}</h2>
        </div>

        <div className="space-y-4">
          {/* Default port */}
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

          {/* Auto-start toggle */}
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

          {/* Divider */}
          <hr className="border-border" />

          {/* Embedded streaming controls */}
          <StreamingControls />
        </div>
      </section>

      {/* Video Section */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.video")}</h2>
        </div>

        <div className="space-y-4">
          {/* ffprobe toggle */}
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

          {/* ffprobe path */}
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

      {/* Collections Section */}
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

      {/* Projector Screens Section */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">{t("settings.projectorScreens")}</h2>
        </div>

        <div className="space-y-5">
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
              <div className="flex w-[28rem] items-center gap-2">
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
