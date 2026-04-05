import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { formatBytes, LANG_DISPLAY } from "../../lib/utils";
import { usePlanPackSync, useStartPackSync } from "../../lib/queries/pack-sync";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { useThemeStore } from "../../stores/theme-store";



export const Route = createFileRoute("/onboarding/content")({
  component: OnboardingContentPage,
});

/** Map UI language code to pack sync BCP 47 tag */
const LANG_TO_BCP47: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es",
};


function OnboardingContentPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const uiLanguage = useThemeStore((s) => s.language);
  const defaultBcp47 = LANG_TO_BCP47[uiLanguage] ?? "pt-BR";

  const [selectedLangs, setSelectedLangs] = useState<string[]>([defaultBcp47]);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const packSyncProgress = useContentSyncStore((s) => s.packSyncProgress);
  const startPackSync = useStartPackSync();

  const planQuery = usePlanPackSync({
    enabled: true,
    selectedLanguages: selectedLangs.length > 0 ? selectedLangs : undefined,
  });

  const availableLangs = planQuery.data?.availableLanguages ?? [];
  const items = (planQuery.data?.items ?? []).filter((i) => !i.packId.startsWith("content-db-"));
  const totalSize = items.reduce((sum, i) => sum + i.packSize, 0);

  // Track download completion
  const downloadStartedRef = useRef(false);
  useEffect(() => {
    if (!downloading || !packSyncProgress) return;
    const status = packSyncProgress.status;
    if (status === "completed" || status === "completed_with_errors") {
      setDownloading(false);
      setDownloadDone(true);
      downloadStartedRef.current = false;
    } else if (status === "failed" || status === "cancelled") {
      setDownloading(false);
      downloadStartedRef.current = false;
    }
  }, [packSyncProgress, downloading]);

  const toggleLang = (lang: string) => {
    setSelectedLangs((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const handleDownload = () => {
    if (items.length === 0) return;
    setDownloading(true);
    downloadStartedRef.current = true;
    startPackSync.mutate({ items, selectedLanguages: selectedLangs });
  };

  const handleContinueInBackground = () => {
    toast.info(t("onboarding.content.backgroundToast"));
    navigate({ to: "/onboarding/monitors" });
  };

  const handleSkip = () => {
    navigate({ to: "/onboarding/monitors" });
  };

  const progressPercent = packSyncProgress
    ? Math.round((packSyncProgress.packsProcessed / Math.max(packSyncProgress.packsTotal, 1)) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            {t("onboarding.content.title")}
          </CardTitle>
          <CardDescription>{t("onboarding.content.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language checkboxes */}
          <div className="flex flex-wrap gap-3">
            {availableLangs.map((lang) => (
              <label key={lang} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLangs.includes(lang)}
                  onChange={() => toggleLang(lang)}
                  disabled={downloading}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm font-medium">{LANG_DISPLAY[lang] ?? lang}</span>
              </label>
            ))}
          </div>

          {/* Pack list */}
          {!downloading && !downloadDone && (
            <>
              {planQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("onboarding.content.loading")}
                </div>
              )}
              {planQuery.isSuccess && items.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("onboarding.content.upToDate")}
                </div>
              )}
              {items.length > 0 && (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.packId} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-foreground truncate">{item.packId}</span>
                      <span className="shrink-0 text-muted-foreground ml-2">
                        {item.fileCount} {item.fileCount === 1 ? t("common.file") : t("common.files")} · {formatBytes(item.packSize)}
                      </span>
                    </div>
                  ))}
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                    {items.length} {items.length === 1 ? t("common.pack") : t("common.packs")} · {formatBytes(totalSize)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Download progress */}
          {downloading && packSyncProgress && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{t("onboarding.content.downloading")}</span>
                <span className="ml-auto text-muted-foreground">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Download complete */}
          {downloadDone && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {t("onboarding.content.downloadComplete")}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!downloading && !downloadDone && (
              <Button onClick={handleDownload} disabled={items.length === 0 || selectedLangs.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {t("onboarding.content.download")}
              </Button>
            )}
            {downloading && (
              <Button variant="outline" onClick={handleContinueInBackground}>
                {t("onboarding.content.continueInBackground")}
              </Button>
            )}
          </div>

          {/* Skip — only show when there are items to download */}
          {!downloading && !downloadDone && items.length > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={handleSkip}>
                {t("onboarding.content.skipTitle")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("onboarding.content.skipWarning")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
        <Button variant="ghost" onClick={() => navigate({ to: "/onboarding/setup" })} disabled={downloading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>
        {(downloadDone || (!downloading && items.length === 0)) && (
          <Button onClick={() => navigate({ to: "/onboarding/monitors" })}>
            {t("onboarding.content.continue")}
          </Button>
        )}
      </div>
    </div>
  );
}
