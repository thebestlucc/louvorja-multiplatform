import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCheckForUpdates, useInstallUpdate } from "../lib/queries";
import { Button } from "./ui/button";

const SKIP_VERSION_KEY = "updater.skipVersion";

export function UpdateNotification() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const installMutation = useInstallUpdate();
  const { data: updateInfo } = useCheckForUpdates({ enabled });

  useEffect(() => {
    const timer = window.setTimeout(() => setEnabled(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const skippedVersion = useMemo(
    () => localStorage.getItem(SKIP_VERSION_KEY),
    [updateInfo?.version],
  );

  if (!updateInfo || dismissed || skippedVersion === updateInfo.version) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-lg border border-border bg-surface p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{t("updater.title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("updater.description", { version: updateInfo.version })}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          onClick={() => setDismissed(true)}
          aria-label={t("actions.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {updateInfo.notes ? (
        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{updateInfo.notes}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            installMutation
              .mutateAsync()
              .then(() => {
                toast.success(t("updater.installing"));
              })
              .catch((error) => {
                toast.error(String(error));
              });
          }}
          disabled={installMutation.isPending}
        >
          <Download className="mr-2 h-4 w-4" />
          {t("updater.updateNow")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setDismissed(true)}>
          {t("updater.remindLater")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            localStorage.setItem(SKIP_VERSION_KEY, updateInfo.version);
            setDismissed(true);
          }}
        >
          {t("updater.skipVersion")}
        </Button>
      </div>
    </div>
  );
}
