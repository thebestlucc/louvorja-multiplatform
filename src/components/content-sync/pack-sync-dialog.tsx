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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
    if (runId) {
      setRunId(runId);
    }
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

        {plan && plan.items.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label={t("settings.packSync.packsToDownload")} value={plan.totalDownloadCount} />
              <Metric label={t("settings.packSync.totalSize")} value={formatBytes(plan.totalDownloadSize)} />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              {plan.items.map((item) => (
                <div key={item.packId} className="flex items-center justify-between border-b border-border p-2 text-sm last:border-b-0">
                  <span className="font-medium">{item.packId}</span>
                  <span className="text-muted-foreground">
                    v{item.packVersion} · {item.fileCount} {t("settings.packSync.files")} · {formatBytes(item.packSize)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("settings.packSync.upToDate")}</p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
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
