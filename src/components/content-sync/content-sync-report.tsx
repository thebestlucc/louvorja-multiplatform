import { Badge } from "../ui/badge";
import { useTranslation } from "react-i18next";
import type { ContentSyncProgress, ContentSyncReport, ContentSyncPlan } from "../../types/content-sync";
import { ScrollArea } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  formatContentSyncEntityType,
  formatContentSyncPlanItemLabel,
  formatContentSyncReason,
} from "../../lib/content-sync-presentation";

interface ContentSyncReportProps {
  progress?: ContentSyncProgress | null;
  report?: ContentSyncReport | null;
  plan?: ContentSyncPlan | null;
}

export function ContentSyncReportCard({
  progress = null,
  report = null,
  plan = null,
}: ContentSyncReportProps) {
  const { t } = useTranslation();
  if (!progress && !report && (!plan || plan.items.length === 0)) {
    return null;
  }

  const status = report?.status ?? progress?.status ?? "idle";
  const step = progress?.step ?? "idle";

  const stepLabelMap: Record<string, string> = {
    starting: t("settings.contentSync.starting"),
    executing: t("settings.contentSync.runningMessage"),
    downloading: t("settings.contentSync.downloading"), // We should add this key
    "fallback-noted": t("settings.contentSync.fallback"),
    fallback: t("settings.contentSync.fallback"),
    cancelled: t("settings.contentSync.cancel"),
    done: t("settings.legacyFetch.stepDone"),
  };

  const translatedStep = stepLabelMap[step] ?? step;
  const metadataSource = report?.metadataSource ?? plan?.summary.metadataSource ?? null;
  const metadataSourceLabel = metadataSource === "db_snapshot"
    ? t("settings.contentSync.metadataSourceSnapshot")
    : metadataSource === "api_fallback"
    ? t("settings.contentSync.metadataSourceApiFallback")
    : t("settings.contentSync.unknown");

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
          <Metric label={t("settings.contentSync.metadataSource")} value={metadataSourceLabel} />
          <Metric label={t("settings.contentSync.requestedVersion")} value={report.requestedVersion ?? t("settings.contentSync.unknown")} />
          <Metric label={t("settings.contentSync.completedVersion")} value={report.completedVersion ?? t("settings.contentSync.unknown")} />
          {report.message ? (
            <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {report.message}
            </div>
          ) : null}
        </div>
      ) : null}

      {plan && plan.items.length > 0 && !(progress && ["pending", "running"].includes(progress.status)) ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t("settings.contentSync.plannedChanges")}</h4>
            <span className="text-xs text-muted-foreground">
              {plan.items.filter(i => i.action === "repair_media").length} {t("settings.contentSync.missingAssets").toLowerCase()}
            </span>
          </div>
          <ScrollArea className="h-[240px] rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[160px] h-9 text-xs">{t("settings.contentSync.itemLabel")}</TableHead>
                  <TableHead className="w-[80px] h-9 text-xs">{t("settings.contentSync.itemType")}</TableHead>
                  <TableHead className="h-9 text-xs">{t("settings.contentSync.itemReason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-2 text-xs font-medium">
                      {formatContentSyncPlanItemLabel(item, t) || item.id}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {formatContentSyncEntityType(item.entityType, t)}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground break-all">
                      {formatContentSyncReason(item.reason, t)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
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
