import { useTranslation } from "react-i18next";
import { Wifi } from "lucide-react";
import { ProjectorControls } from "../display/projector-controls";

export function StatusBar() {
  const { t } = useTranslation();

  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-muted-foreground">
      <span>{t("status.ready")}</span>

      <div className="flex items-center gap-3">
        <ProjectorControls />
        <span className="flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          {t("status.streamingOff")}
        </span>
      </div>
    </footer>
  );
}
