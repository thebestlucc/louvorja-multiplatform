import { useState, useEffect } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { Palette, Monitor, Upload, X } from "lucide-react";
import { useSetting, useSetSetting, useCopyImageToMedia } from "../../lib/queries";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { useThemeStore } from "../../stores/theme-store";
import { THEMES } from "../../lib/constants";
import {
  PROJECTOR_LOGO_IMAGE_PATH_KEY,
  PROJECTOR_SCREEN_CONTENT_TYPE_KEY,
  PROJECTOR_SCREEN_MEDIA_PATH_KEY,
  PROJECTOR_SCREEN_TEXT_KEY,
  type ProjectorScreenDefaultContentType,
  isProjectorScreenDefaultContentType,
} from "../../lib/projector-screen-defaults";
import { useMediaSource } from "../../hooks/use-media-source";
import { isTheme } from "./toggle-button";
import { ProjectionSection } from "./projection-section";

export function AppearanceSection() {
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
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "tif", "tiff", "ico"] }],
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
      filters: [{ name: "Video", extensions: ["mp4", "webm", "mov", "m4v", "ogv", "3gp"] }],
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
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "tif", "tiff", "ico"] }],
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

      {/* Projection display (font size + family) */}
      <ProjectionSection />

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
