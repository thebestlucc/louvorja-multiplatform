import { useState } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { FolderOpen, Trash2 } from "lucide-react";
import { useClearDatabase } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { openMediaFolder } from "../../lib/tauri";

export function DataSection() {
  const { t } = useTranslation();
  const clearDatabaseMutation = useClearDatabase();
  const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);

  const handleClearDatabase = async () => {
    const [_, error] = await catcher(clearDatabaseMutation.mutateAsync(), {
      notify: true,
      fallbackMessage: t("settings.dangerZone.clearDatabaseError", { error: "" }),
    });

    if (error) {
      // Notification handled by catcher
    } else {
      setShowClearDbConfirm(false);
      notify.success(t("settings.dangerZone.clearDatabaseSuccess"));
    }
  };

  const handleOpenMediaFolder = async () => {
    await catcher(openMediaFolder(), { notify: true });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium">{t("settings.storage.title")}</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <label className="text-sm font-medium">{t("settings.storage.mediaFolder")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.storage.mediaFolderDesc")}</p>
          </div>
          <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => void handleOpenMediaFolder()}>
            <FolderOpen className="mr-2 h-4 w-4" />
            {t("settings.storage.openFolder")}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/50 bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-medium text-destructive">{t("settings.dangerZone.title")}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <label className="text-sm font-medium">{t("settings.dangerZone.clearDatabase")}</label>
              <p className="text-xs text-muted-foreground">{t("settings.dangerZone.clearDatabaseDesc")}</p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setShowClearDbConfirm(true)}
              disabled={clearDatabaseMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("settings.dangerZone.clearDatabaseButton")}
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={showClearDbConfirm} onOpenChange={setShowClearDbConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.dangerZone.clearDatabaseConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.dangerZone.clearDatabaseConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDbConfirm(false)}
              disabled={clearDatabaseMutation.isPending}
            >
              {t("settings.dangerZone.clearDatabaseCancelButton")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleClearDatabase()}
              disabled={clearDatabaseMutation.isPending}
            >
              {clearDatabaseMutation.isPending ? "..." : t("settings.dangerZone.clearDatabaseConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
