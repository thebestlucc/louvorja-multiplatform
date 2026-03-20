import { useState } from "react";
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
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PackSyncPlanItem } from "../../types/content-sync";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const FILE_TYPE_BADGE: Record<string, string> = {
  audio: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  playback: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  cover: "bg-green-500/10 text-green-600 dark:text-green-400",
  album_cover: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function PackRow({ item }: { item: PackSyncPlanItem }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Pack header — clickable to expand */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 text-left font-medium">{item.packId}</span>
        <span className="text-muted-foreground">
          v{item.packVersion} · {item.fileCount} {t("settings.packSync.files")} · {formatBytes(item.packSize)}
        </span>
      </button>

      {/* Expandable file list */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
          {item.files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${FILE_TYPE_BADGE[file.fileType] ?? "bg-muted text-muted-foreground"}`}
              >
                {file.fileType}
              </span>
              <span className="flex-1 truncate font-mono text-muted-foreground" title={file.path}>
                {file.path}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
            </div>
          ))}
        </div>
      )}
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

  const handleStart = async () => {
    const [runId, error] = await catcher(startMutation.mutateAsync());
    if (error) {
      toast.error(String(error));
      return;
    }
    if (runId) setRunId(runId);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.packSync.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings.packSync.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {plan && plan.items.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label={t("settings.packSync.packsToDownload")} value={plan.totalDownloadCount} />
                <Metric label={t("settings.packSync.totalSize")} value={formatBytes(plan.totalDownloadSize)} />
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                {plan.items.map((item) => (
                  <PackRow key={item.packId} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.packSync.upToDate")}</p>
          )}
        </div>

        <DialogFooter className="mt-6 gap-2 sm:justify-between">
          <Button variant="ghost" onClick={close}>
            {t("settings.packSync.later")}
          </Button>
          <Button
            onClick={() => void handleStart()}
            disabled={!plan || plan.items.length === 0 || startMutation.isPending}
          >
            {startMutation.isPending
              ? t("settings.packSync.starting")
              : t("settings.packSync.downloadAndApply")}
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
