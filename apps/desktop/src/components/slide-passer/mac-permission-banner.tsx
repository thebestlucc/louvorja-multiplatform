import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { catcher } from "../../lib/catcher";

export function MacPermissionBanner() {
  const { t } = useTranslation();
  const [isMac, setIsMac] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        // Use navigator.platform as fallback (plugin-os not available)
        const isMacOS =
          navigator.platform.toLowerCase().includes("mac") ||
          navigator.userAgent.toLowerCase().includes("mac");
        setIsMac(isMacOS);
        if (isMacOS) {
          const [result] = await catcher(invoke<boolean>("check_accessibility_permission"));
          setHasPermission(result ?? null);
        }
      } catch {
        // Platform check failed — silently ignore
      }
    };
    checkPlatform();
  }, []);

  if (!isMac || hasPermission !== false) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
          {t("slidePasser.macPermissionTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("slidePasser.macPermissionDesc")}
        </p>
      </div>
    </div>
  );
}
