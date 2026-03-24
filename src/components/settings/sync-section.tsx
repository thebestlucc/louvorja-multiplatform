import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlanPackSync } from "../../lib/queries";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { Button } from "../../components/ui/button";

export function SyncSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-medium">{t("settings.packSync.title")}</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("settings.packSync.description")}
        </p>
        <PackSyncSettingsInline />
      </section>
    </div>
  );
}

function PackSyncSettingsInline() {
  const { t } = useTranslation();
  const planQuery = usePlanPackSync({ enabled: false, forceRefresh: true });
  const openPackSyncPlan = useContentSyncStore((s) => s.openPackSyncPlan);
  const packSyncProgress = useContentSyncStore((s) => s.packSyncProgress);
  const isRunning = packSyncProgress != null &&
    (packSyncProgress.status === "pending" || packSyncProgress.status === "running");

  const handleCheckNow = async () => {
    const result = await planQuery.refetch({ cancelRefetch: true });
    if (result.error) {
      const err = result.error as { message?: string } | Error;
      const msg = err instanceof Error ? err.message : (err.message ?? String(err));
      toast.error(t("settings.packSync.checkError", { error: msg.slice(0, 120) }));
      return;
    }
    const plan = result.data;
    if (!plan) {
      toast.success(t("settings.packSync.upToDate"));
      return;
    }
    // Pack sync not configured in this build (CDN_MANIFEST_URL empty) — skip silently.
    if (plan.manifestVersion === 0 && plan.availableLanguages.length === 0) {
      return;
    }
    // No language selected yet but languages are available on CDN → open dialog for setup
    const needsLanguageSetup = plan.selectedLanguages.length === 0 && plan.availableLanguages.length > 0;
    if (plan.items.length === 0 && !needsLanguageSetup) {
      toast.success(t("settings.packSync.upToDate"));
      return;
    }
    openPackSyncPlan();
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {isRunning
          ? t("settings.packSync.statusBar", {
              current: packSyncProgress!.packsProcessed,
              total: packSyncProgress!.packsTotal,
            })
          : null}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void handleCheckNow()}
        disabled={planQuery.isFetching || isRunning}
      >
        {planQuery.isFetching ? t("settings.packSync.checking") : t("settings.packSync.checkNow")}
      </Button>
    </div>
  );
}
