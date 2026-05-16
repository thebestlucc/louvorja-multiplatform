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
import type { ContentSyncSummary } from "../../types/content-sync";

interface ContentSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ContentSyncSummary | null;
  onOpenSettings: () => void;
}

export function ContentSyncModal({
  open,
  onOpenChange,
  summary,
  onOpenSettings,
}: ContentSyncModalProps) {
  const { t } = useTranslation();
  if (!summary) {
    return null;
  }

  const isDegraded = summary.mode === "degraded";
  const metadataSourceLabel = summary.metadataSource === "db_snapshot"
    ? t("settings.contentSync.metadataSourceSnapshot")
    : summary.metadataSource === "api_fallback"
    ? t("settings.contentSync.metadataSourceApiFallback")
    : t("settings.contentSync.unknown");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.contentSync.modalTitle")}</DialogTitle>
          <DialogDescription>
            {isDegraded
              ? t("settings.contentSync.modalDegradedDescription")
              : t("settings.contentSync.modalSmartDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label={t("settings.contentSync.currentVersion")} value={summary.currentVersion ?? t("settings.contentSync.unknown")} />
          <Metric label={t("settings.contentSync.remoteVersion")} value={summary.remoteVersion ?? t("settings.contentSync.unknown")} />
          <Metric label={t("settings.contentSync.changedHymns")} value={summary.changedHymnCount} />
          <Metric label={t("settings.contentSync.changedAlbums")} value={summary.changedAlbumCount} />
          <Metric label={t("settings.contentSync.missingAssets")} value={summary.missingAssetCount} />
          <Metric label={t("settings.contentSync.metadataSource")} value={metadataSourceLabel} />
          <Metric label={t("settings.contentSync.lastStatus")} value={summary.lastSyncStatus ?? t("settings.contentSync.unknown")} />
        </div>

        {summary.lastError ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {summary.lastError}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("settings.contentSync.later")}
          </Button>
          <Button onClick={onOpenSettings}>
            {isDegraded
              ? t("settings.contentSync.openSyncFallback")
              : t("settings.contentSync.openSync")}
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
