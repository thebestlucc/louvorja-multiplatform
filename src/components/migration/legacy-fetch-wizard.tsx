import { Cloud, Download, RefreshCw, CheckCircle2, AlertTriangle, StopCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LegacyFetchOptions, LegacyFetchProgress, LegacyFetchReport, ApiLanguage } from "../../lib/bindings";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface LegacyFetchWizardProps {
  onStartFetch: (options: LegacyFetchOptions) => void;
  loading?: boolean;
  connectionStatus?: "idle" | "connecting" | "connected" | "failed";
  connectionError?: string | null;
  onTestConnection?: () => void;
}

export function LegacyFetchWizard({
  onStartFetch,
  loading,
  connectionStatus = "idle",
  connectionError,
  onTestConnection,
}: LegacyFetchWizardProps) {
  const { t, i18n } = useTranslation();
  const [options, setOptions] = useState<LegacyFetchOptions>({
    language: (i18n.language as ApiLanguage) || "pt",
    replace_existing: false,
    download_audio: true,
    download_images: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          {t("settings.legacyFetch.title")}
        </CardTitle>
        <CardDescription>{t("settings.legacyFetch.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-3 w-3 rounded-full",
              connectionStatus === "connected" && "bg-green-500",
              connectionStatus === "connecting" && "bg-yellow-500 animate-pulse",
              connectionStatus === "failed" && "bg-red-500",
              connectionStatus === "idle" && "bg-gray-400"
            )}
          />
          <span className="text-sm text-muted-foreground">
            {connectionStatus === "connected" && t("settings.legacyFetch.statusConnected")}
            {connectionStatus === "connecting" && t("settings.legacyFetch.statusConnecting")}
            {connectionStatus === "failed" && t("settings.legacyFetch.statusFailed")}
            {connectionStatus === "idle" && t("settings.legacyFetch.statusIdle")}
          </span>
          {onTestConnection && connectionStatus !== "connecting" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onTestConnection}
              className="ml-auto text-xs"
            >
              {t("settings.legacyFetch.testConnection")}
            </Button>
          )}
        </div>

        {connectionError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {connectionError}
          </p>
        )}

        {/* Language Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("settings.legacyFetch.languageLabel")}
          </label>
          <select
            value={options.language}
            onChange={(e) => setOptions({ ...options, language: e.target.value as ApiLanguage })}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="pt">{t("settings.legacyFetch.languagePt")}</option>
            <option value="en">{t("settings.legacyFetch.languageEn")}</option>
            <option value="es">{t("settings.legacyFetch.languageEs")}</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {t("settings.legacyFetch.languageHint")}
          </p>
        </div>

        {/* Options */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            {t("settings.legacyFetch.optionsTitle")}
          </legend>
          <OptionToggle
            label={t("settings.legacyFetch.optionReplace")}
            hint={t("settings.legacyFetch.optionReplaceHint")}
            checked={options.replace_existing}
            onChange={(checked) => setOptions({ ...options, replace_existing: checked })}
          />
          <OptionToggle
            label={t("settings.legacyFetch.optionDownloadAudio")}
            hint={t("settings.legacyFetch.optionDownloadAudioHint")}
            checked={options.download_audio}
            onChange={(checked) => setOptions({ ...options, download_audio: checked })}
          />
          <OptionToggle
            label={t("settings.legacyFetch.optionDownloadImages")}
            hint={t("settings.legacyFetch.optionDownloadImagesHint")}
            checked={options.download_images}
            onChange={(checked) => setOptions({ ...options, download_images: checked })}
          />
        </fieldset>

        {/* Start Button */}
        <Button
          type="button"
          onClick={() => onStartFetch(options)}
          disabled={loading || connectionStatus === "connecting"}
          className="w-full"
        >
          {loading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t("settings.legacyFetch.startFetch")}
        </Button>
      </CardContent>
    </Card>
  );
}

function OptionToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 hover:bg-surface-hover">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <div className="flex flex-col">
        <span className="text-sm">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </label>
  );
}

interface LegacyFetchProgressProps {
  progress: LegacyFetchProgress | null;
  report: LegacyFetchReport | null;
  cancelling?: boolean;
  onCancel: () => void;
  onDone: () => void;
  onRetry: () => void;
}

export function LegacyFetchProgressCard({
  progress,
  report,
  cancelling,
  onCancel,
  onDone,
  onRetry,
}: LegacyFetchProgressProps) {
  const { t } = useTranslation();
  const status = progress?.status ?? "pending";
  const isRunning = ["pending", "fetching", "importing", "downloading"].includes(status);
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  const statusIcon = isCompleted ? (
    <CheckCircle2 className="h-5 w-5 text-green-500" />
  ) : isFailed ? (
    <AlertTriangle className="h-5 w-5 text-destructive" />
  ) : isCancelled ? (
    <StopCircle className="h-5 w-5 text-yellow-500" />
  ) : (
    <Loader2 className="h-5 w-5 text-primary animate-spin" />
  );

  const statusLabel = isCompleted
    ? t("settings.legacyFetch.statusCompleted")
    : isFailed
      ? t("settings.legacyFetch.statusError")
      : isCancelled
        ? t("settings.legacyFetch.statusCancelled")
        : t("settings.legacyFetch.statusFetching");

  const stepLabelMap: Record<string, string> = {
    connecting: t("settings.legacyFetch.stepConnecting"),
    fetching: t("settings.legacyFetch.stepFetching"),
    importing: t("settings.legacyFetch.stepImporting"),
    fetching_albums: t("settings.legacyFetch.stepFetchingAlbums"),
    importing_album: t("settings.legacyFetch.stepImportingAlbum"),
    importing_album_music: t("settings.legacyFetch.stepImportingAlbumMusic"),
    done: t("settings.legacyFetch.stepDone"),
  };
  const translatedStep = progress?.step ? (stepLabelMap[progress.step] ?? progress.step) : "...";
  const groupedErrors = report ? groupLegacyFetchErrors(report.errors) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {statusIcon}
          {t("settings.legacyFetch.progressTitle")}
        </CardTitle>
        <CardDescription>{statusLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{translatedStep}</span>
            <span>{Math.round(progress?.percent ?? 0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isFailed ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
        </div>

        {/* Message */}
        {progress?.message && (
          <p className="text-sm text-muted-foreground">{progress.message}</p>
        )}

        {/* Stats */}
        {progress && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              {t("settings.legacyFetch.itemsProcessed", {
                current: progress.itemsProcessed,
                total: progress.itemsTotal,
              })}
            </span>
          </div>
        )}

        {/* Sub-tasks */}
        {progress?.subTasks && progress.subTasks.length > 0 && (
          <div className="space-y-3 border-t border-border pt-3">
            {progress.subTasks.map((subTask) => (
              <div key={subTask.id} className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="max-w-[70%] truncate">
                    {subTask.id === "hymnal" && subTask.percent < 100 ? `${t("nav.hymnal")}: ` : ""}
                    {subTask.title}
                  </span>
                  <span>{t(`settings.legacyFetch.${subTask.status}`)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${subTask.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Report Summary */}
        {report && (
          <div className="rounded-md border border-border bg-surface-hover p-3">
            <h4 className="mb-2 text-sm font-medium">
              {t("settings.legacyFetch.reportTitle")}
            </h4>
            {/* Check for NO_CONTENT_AVAILABLE error */}
            {report.errors.some(e => e.message.startsWith("NO_CONTENT_AVAILABLE:")) ? (
              <div className="text-sm text-muted-foreground">
                {t("settings.legacyFetch.noContentMessage", {
                  language: (() => {
                    const error = report.errors.find(e => e.message.startsWith("NO_CONTENT_AVAILABLE:"));
                    const lang = error?.message.split(":")[1];
                    return lang === "pt" ? t("settings.legacyFetch.languagePt")
                      : lang === "es" ? t("settings.legacyFetch.languageEs")
                        : t("settings.legacyFetch.languageEn");
                  })(),
                })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">{t("settings.legacyFetch.reportFetched")}</span>
                    <span className="ml-1 font-medium">{report.hymnsFetched}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("settings.legacyFetch.reportImported")}</span>
                    <span className="ml-1 font-medium text-green-600">{report.hymnsImported}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("settings.legacyFetch.reportSkipped")}</span>
                    <span className="ml-1 font-medium text-yellow-600">{report.hymnsSkipped}</span>
                  </div>
                  {(report.albumsCreated > 0 || report.collectionHymnsLinked > 0) && (
                    <>
                      <div>
                        <span className="text-muted-foreground">{t("settings.legacyFetch.reportAlbumsCreated")}</span>
                        <span className="ml-1 font-medium text-blue-600">{report.albumsCreated}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("settings.legacyFetch.reportHymnsLinked")}</span>
                        <span className="ml-1 font-medium text-blue-600">{report.collectionHymnsLinked}</span>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-muted-foreground">{t("settings.legacyFetch.reportDuration")}</span>
                    <span className="ml-1 font-medium">{(report.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                </div>
                {groupedErrors.length > 0 && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{t("settings.legacyFetch.reportErrors", { count: report.errors.length })}</span>
                    </div>
                    <ul className="max-h-40 space-y-2 overflow-y-auto pr-1 text-xs text-foreground">
                      {groupedErrors.map((error, index) => (
                        <li
                          key={`${error.message}-${index}`}
                          className="flex items-start gap-2 rounded-md bg-background/70 px-2 py-1.5"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                          <span className="min-w-0 flex-1 break-words">{error.message}</span>
                          {error.count > 1 && (
                            <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              {error.count}x
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isRunning && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={cancelling}
              className="flex-1"
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cancelling ? t("settings.legacyFetch.cancelling") : t("settings.legacyFetch.cancel")}
            </Button>
          )}
          {(isCompleted || isCancelled) && (
            <Button type="button" onClick={onDone} className="flex-1">
              {t("settings.legacyFetch.done")}
            </Button>
          )}
          {isFailed && (
            <>
              <Button type="button" variant="outline" onClick={onDone} className="flex-1">
                {t("settings.legacyFetch.close")}
              </Button>
              <Button type="button" onClick={onRetry} className="flex-1">
                {t("settings.legacyFetch.retry")}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function groupLegacyFetchErrors(errors: Array<{ message: string }>) {
  const grouped = new Map<string, number>();

  for (const error of errors) {
    const message = error.message.trim();
    if (!message || message.startsWith("NO_CONTENT_AVAILABLE:")) {
      continue;
    }

    grouped.set(message, (grouped.get(message) ?? 0) + 1);
  }

  return Array.from(grouped.entries()).map(([message, count]) => ({ message, count }));
}
