import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useTranslation } from "react-i18next";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { usePlanPackSync, useStartPackSync } from "../../lib/queries";
import { catcher } from "../../lib/catcher";
import { toast } from "sonner";
import { ChevronRight, CheckCircle2, XCircle, Loader2, Clock, Download } from "lucide-react";
import { cn } from "../../lib/utils";
import type { PackSyncPlanItem } from "../../types/content-sync";

function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
}

const LANG_DISPLAY: Record<string, string> = {
  "pt-BR": "Portugues (Brasil)",
  "es": "Espanol",
  "en-US": "English (US)",
};

const FILE_TYPE_BADGE: Record<string, string> = {
  audio: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  playback: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  cover: "bg-green-500/10 text-green-600 dark:text-green-400",
  album_cover: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function PackRow({ item, onDownload }: { item: PackSyncPlanItem; onDownload: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!innerRef.current) return;
    setHeight(expanded ? Math.min(innerRef.current.scrollHeight, 208) : 0);
  }, [expanded]);

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex w-full items-center gap-2 px-3 py-2.5 text-sm">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 min-w-0 hover:bg-muted/40 transition-colors rounded -mx-1 px-1"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <span className="flex-1 text-left font-medium truncate">{item.packId}</span>
          <span className="shrink-0 text-muted-foreground">
            v{item.packVersion} · {item.fileCount} {t("settings.packSync.files")} · {formatBytes(item.packSize)}
          </span>
        </button>
        <button
          type="button"
          title={t("settings.packSync.downloadSingle")}
          className="cursor-pointer shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={onDownload}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        style={{ height, overflow: "hidden", transition: "height 220ms cubic-bezier(0.4,0,0.2,1)" }}
      >
        <div ref={innerRef} className="border-t border-border/50 bg-muted/20 px-3 py-2 space-y-1 overflow-y-auto" style={{ maxHeight: 208 }}>
          {item.files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${FILE_TYPE_BADGE[file.fileType] ?? "bg-muted text-muted-foreground"}`}
              >
                {t(`settings.packSync.fileType.${file.fileType}`, { defaultValue: file.fileType })}
              </span>
              <span className="flex-1 truncate font-mono text-muted-foreground" title={file.path}>
                {file.path}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PackSyncDialog() {
  const { t } = useTranslation();
  const open = useContentSyncStore((s) => s.packSyncPlanOpen);
  const close = useContentSyncStore((s) => s.closePackSyncPlan);
  const setRunId = useContentSyncStore((s) => s.setPackSyncRunId);
  const planQuery = usePlanPackSync({ enabled: open });
  const startMutation = useStartPackSync();
  const plan = planQuery.data;
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);

  const openPackSyncProgress = useContentSyncStore((s) => s.openPackSyncProgress);

  useEffect(() => {
    if (plan?.selectedLanguages?.length) {
      setSelectedLangs(plan.selectedLanguages);
    }
  }, [plan?.selectedLanguages]);

  const handleStart = async (items?: PackSyncPlanItem[]) => {
    const [runId, error] = await catcher(startMutation.mutateAsync({ items, selectedLanguages: selectedLangs.length > 0 ? selectedLangs : null }));
    if (error) {
      toast.error(String(error));
      return;
    }
    if (runId) setRunId(runId);
    close();
    openPackSyncProgress();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-3xl text-base">
        <DialogHeader>
          <DialogTitle>{t("settings.packSync.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings.packSync.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {(() => {
            const needsLangSetup = !!plan && plan.selectedLanguages.length === 0 && plan.availableLanguages.length > 0;
            const hasItems = !!plan && plan.items.length > 0;

            if (hasItems || needsLangSetup) {
              return (
                <div className="space-y-3">
                  {plan!.availableLanguages.length > 0 && (
                    <div className="space-y-2 px-3 py-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("settings.packSync.selectLanguages")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {plan!.availableLanguages.map((lang) => (
                          <label key={lang} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedLangs.includes(lang)}
                              onChange={(e) => {
                                setSelectedLangs((prev) =>
                                  e.target.checked
                                    ? [...prev, lang]
                                    : prev.filter((l) => l !== lang)
                                );
                              }}
                            />
                            {LANG_DISPLAY[lang] ?? lang}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasItems && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <Metric label={t("settings.packSync.packsToDownload")} value={plan!.totalDownloadCount} />
                        <Metric label={t("settings.packSync.totalSize")} value={formatBytes(plan!.totalDownloadSize)} />
                      </div>
                      <div className="rounded-md border border-border overflow-hidden max-h-72 overflow-y-auto">
                        {Object.entries(
                          plan!.items.reduce<Record<string, typeof plan.items>>((acc, item) => {
                            (acc[item.language] ??= []).push(item);
                            return acc;
                          }, {})
                        ).map(([lang, items]) => (
                          <div key={lang}>
                            <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-muted/60 backdrop-blur-sm border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {LANG_DISPLAY[lang] ?? lang}
                              <span className="ml-auto font-normal normal-case">{items.length} {t("settings.packSync.packs", { defaultValue: "packs" })}</span>
                            </div>
                            {items.map((item) => (
                              <PackRow key={item.packId} item={item} onDownload={() => void handleStart([item])} />
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {needsLangSetup && !hasItems && (
                    <p className="text-sm text-muted-foreground px-1">
                      {t("settings.packSync.selectLanguagesHint", { defaultValue: "Select a language above, then click Download to get started." })}
                    </p>
                  )}
                </div>
              );
            }

            return <p className="text-sm text-muted-foreground">{t("settings.packSync.upToDate")}</p>;
          })()}
        </div>

        <DialogFooter className="mt-6 gap-2 sm:justify-between">
          <Button variant="ghost" onClick={close}>
            {t("settings.packSync.later")}
          </Button>
          <Button
            onClick={() => void handleStart(undefined)}
            disabled={
              !plan ||
              startMutation.isPending ||
              selectedLangs.length === 0 ||
              (plan.items.length === 0 && plan.selectedLanguages.length > 0)
            }
          >
            {startMutation.isPending
              ? t("settings.packSync.starting")
              : t("settings.packSync.downloadNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

const ACTIVE_STATUSES = new Set(["downloading", "verifying", "extracting", "db_update"]);
const DONE_STATUSES = new Set(["done", "ready"]);
const FAILED_STATUSES = new Set(["failed"]);
const SKIPPED_STATUSES = new Set(["skipped"]);

function PackStatusIcon({ status }: { status: string }) {
  if (ACTIVE_STATUSES.has(status))
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-400" />;
  if (DONE_STATUSES.has(status))
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  if (FAILED_STATUSES.has(status))
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  if (SKIPPED_STATUSES.has(status))
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  return <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

export function PackSyncProgressDialog() {
  const { t } = useTranslation();
  const open = useContentSyncStore((s) => s.packSyncProgressOpen);
  const close = useContentSyncStore((s) => s.closePackSyncProgress);
  const plan = useContentSyncStore((s) => s.packSyncPlan);
  const progress = useContentSyncStore((s) => s.packSyncProgress);

  const statuses = progress?.packStatuses ?? {};
  const percent = progress?.percent ?? 0;
  const isDone = progress?.status === "completed" || progress?.status === "failed" || progress?.status === "cancelled";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl text-base">
        <DialogHeader>
          <DialogTitle>{t("settings.packSync.progressTitle")}</DialogTitle>
          <DialogDescription>
            {isDone
              ? t("settings.packSync.progressDone")
              : t("settings.packSync.statusBar", {
                  current: progress?.packsProcessed ?? 0,
                  total: progress?.packsTotal ?? 0,
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          {/* Per-pack list */}
          {plan && plan.items.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden max-h-80 overflow-y-auto">
              {plan.items.map((item) => {
                const status = statuses[item.packId] ?? "pending";
                return (
                  <div
                    key={item.packId}
                    className={cn(
                      "flex items-center gap-3 border-b border-border last:border-b-0 px-3 py-2 text-sm",
                      status === "failed" && "bg-destructive/5",
                    )}
                  >
                    <PackStatusIcon status={status} />
                    <span className="flex-1 font-medium truncate">{item.packId}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(item.packSize)}
                    </span>
                    <span className={cn(
                      "shrink-0 text-xs",
                      ACTIVE_STATUSES.has(status) && "text-sky-400",
                      DONE_STATUSES.has(status) && "text-emerald-500",
                      FAILED_STATUSES.has(status) && "text-destructive",
                      !ACTIVE_STATUSES.has(status) && !DONE_STATUSES.has(status) && !FAILED_STATUSES.has(status) && "text-muted-foreground",
                    )}>
                      {t(`settings.packSync.packStatus.${status}`, { defaultValue: status })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {progress?.message && (
            <p className="text-xs text-muted-foreground truncate">{progress.message}</p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={close} disabled={!isDone}>
            {isDone ? t("settings.packSync.close") : t("settings.packSync.runningInBackground")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
