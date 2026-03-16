import { Badge } from "../ui/badge";
import { useTranslation } from "react-i18next";
import type { ContentSyncProgress, ContentSyncReport } from "../../types/content-sync";

interface ContentSyncReportProps {
  progress?: ContentSyncProgress | null;
  report?: ContentSyncReport | null;
}

export function ContentSyncReportCard({
  progress = null,
  report = null,
}: ContentSyncReportProps) {
  const { t } = useTranslation();
  if (!progress && !report) {
    return null;
  }

  const status = report?.status ?? progress?.status ?? "pending";
  const step = progress?.step ?? "idle";

  const stepLabelMap: Record<string, string> = {
    starting: t("settings.contentSync.starting"),
    executing: t("settings.contentSync.runningMessage"),
    downloading: t("settings.contentSync.downloading"), // We should add this key
    fallback: t("settings.contentSync.fallback"),
    cancelled: t("settings.contentSync.cancel"),
    done: t("settings.legacyFetch.stepDone"),
  };

  const translatedStep = stepLabelMap[step] ?? step;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">{t("settings.contentSync.reportTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("settings.contentSync.reportDescription")}
          </p>
        </div>
        <Badge
          variant={
            status === "completed"
              ? "default"
              : status === "failed"
              ? "destructive"
              : status === "cancelled"
              ? "secondary"
              : "outline"
          }
        >
          {status}
        </Badge>
      </div>

      {progress ? (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col">
              <span className="font-medium text-primary uppercase text-[10px] tracking-wider">
                {translatedStep}
              </span>
              <span className="text-muted-foreground truncate max-w-[300px]">
                {progress.message ?? t("settings.contentSync.runningMessage")}
              </span>
            </div>
            <span className="font-mono">{Math.round(progress.percent)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {t("settings.contentSync.processed", {
              current: progress.itemsProcessed,
              total: progress.itemsTotal,
            })}
          </div>
        </div>
      ) : null}

      {report ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label={t("settings.contentSync.applied")} value={report.appliedCount} />
          <Metric label={t("settings.contentSync.skipped")} value={report.skippedCount} />
          <Metric label={t("settings.contentSync.failed")} value={report.failedCount} />
          <Metric label={t("settings.contentSync.fallback")} value={report.fallbackUsed ? t("settings.contentSync.yes") : t("settings.contentSync.no")} />
          <Metric label={t("settings.contentSync.requestedVersion")} value={report.requestedVersion ?? t("settings.contentSync.unknown")} />
          <Metric label={t("settings.contentSync.completedVersion")} value={report.completedVersion ?? t("settings.contentSync.unknown")} />
          {report.message ? (
            <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {report.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-medium text-foreground">{value}</div>
    </div>
  );
}
