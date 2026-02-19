import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { onUpdateDeferredChange } from "../update-notification";

export function StatusBarUpdateIndicator() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => onUpdateDeferredChange(setVisible), []);

  if (!visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground"
          aria-label={t("updater.guardActive")}
        >
          <Download className="h-3 w-3" />
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t("updater.guardActive")}</TooltipContent>
    </Tooltip>
  );
}
