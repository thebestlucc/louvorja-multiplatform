import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { RefreshCw } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { validateYoutubeApiKey, updateYtdlp } from "../../lib/tauri";
import { getPreference, setPreference } from "../../lib/store";

export function YouTubeSection() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [quality, setQuality] = useState("720");
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);

  // Load saved preferences
  useEffect(() => {
    void (async () => {
      const [key] = await catcher(getPreference<string>("youtube_api_key", ""));
      setApiKey(key ?? "");
      setApiKeyLoaded(true);
      const [q] = await catcher(getPreference<string>("youtube_download_quality", "720"));
      setQuality(q ?? "720");
    })();
  }, []);

  // Listen for validation and yt-dlp events
  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    const setup = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisteners.push(
        await listen<{ valid: boolean; error: string | null }>("youtube-api-key-validated", (event) => {
          setValidating(false);
          if (event.payload.valid) {
            notify.success(t("settings.youtube.validationSuccess"));
          } else {
            notify.error(event.payload.error ?? t("settings.youtube.validationFailed"));
          }
        }),
      );
      unlisteners.push(
        await listen<string>("ytdlp-binary-ready", () => {
          setUpdatingYtdlp(false);
          notify.success(t("settings.youtube.ytdlpUpdated"));
        }),
      );
      unlisteners.push(
        await listen<string>("ytdlp-binary-error", (event) => {
          setUpdatingYtdlp(false);
          notify.error(event.payload);
        }),
      );
    };
    setup();
    return () => { unlisteners.forEach((u) => u()); };
  }, [t]);

  const handleSaveApiKey = async () => {
    await catcher(setPreference("youtube_api_key", apiKey), { notify: true });
    notify.success(t("settings.youtube.keySaved"));
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) return;
    setValidating(true);
    await catcher(validateYoutubeApiKey(apiKey), { notify: true });
  };

  const handleQualityChange = async (value: string) => {
    setQuality(value);
    await catcher(setPreference("youtube_download_quality", value), { notify: true });
  };

  const handleUpdateYtdlp = async () => {
    setUpdatingYtdlp(true);
    await catcher(updateYtdlp(), { notify: true });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("settings.tabs.youtube")}</h2>

      {/* API Key */}
      <div className="space-y-3 rounded-lg border border-border p-4 w-full">
        <h3 className="text-sm font-medium">{t("settings.youtube.apiKeyTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.youtube.apiKeyDescription")}</p>
        <div className="flex items-center gap-2">
          <Input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("settings.youtube.apiKeyPlaceholder")}
            className="flex-1 min-w-[50ch]"
          />
          <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
            {showKey ? t("settings.youtube.hide") : t("settings.youtube.show")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => handleSaveApiKey()} disabled={!apiKeyLoaded}>
            {t("actions.save")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleValidate()} disabled={validating || !apiKey.trim()}>
            {validating ? t("settings.youtube.validating") : t("settings.youtube.validate")}
          </Button>
        </div>
      </div>

      {/* Download Quality */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">{t("settings.youtube.qualityTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.youtube.qualityDescription")}</p>
        <Select value={quality} onValueChange={(v) => handleQualityChange(v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="720">720p</SelectItem>
            <SelectItem value="1080">1080p</SelectItem>
            <SelectItem value="best">{t("settings.youtube.qualityBest")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* yt-dlp Management */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">{t("settings.youtube.ytdlpTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.youtube.ytdlpDescription")}</p>
        <Button size="sm" variant="outline" onClick={() => handleUpdateYtdlp()} disabled={updatingYtdlp}>
          <RefreshCw className={cn("h-4 w-4 mr-1", updatingYtdlp && "animate-spin")} />
          {updatingYtdlp ? t("settings.youtube.ytdlpUpdating") : t("settings.youtube.ytdlpUpdate")}
        </Button>
      </div>
    </div>
  );
}
