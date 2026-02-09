import { useTranslation } from "react-i18next";
import { Monitor, Wifi } from "lucide-react";

export function StatusBar() {
  const { t } = useTranslation();

  return (
    <footer className="flex h-6 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-muted-foreground">
      <span>{t("status.ready")}</span>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Monitor className="h-3 w-3" />
          {t("status.projectorOff")}
        </span>
        <span className="flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          {t("status.streamingOff")}
        </span>
      </div>
    </footer>
  );
}
