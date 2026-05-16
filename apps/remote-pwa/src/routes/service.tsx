import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Square } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";
import type { WsOpName } from "../lib/ws-ops";

export default function ServiceRoute() {
  const { t } = useTranslation();
  const ws = useConnectionStore((s) => s.ws);
  const service = useConnectionStore((s) => s.currentService);

  const sendCmd = useCallback(
    (op: WsOpName, payload: Record<string, unknown> = {}) => {
      ws?.send(op, payload);
    },
    [ws],
  );

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <p className="text-sm text-fg-muted">{t("remote.service.no_service")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Service header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-fg truncate">{service.title}</h2>
        <button
          type="button"
          aria-label={t("remote.service.stop")}
          onClick={() => sendCmd("service.stop", {})}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-destructive/10 text-destructive border border-destructive/20",
            "hover:bg-destructive/20 active:scale-95 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive",
          )}
        >
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
          {t("remote.service.stop")}
        </button>
      </div>

      {/* Prev / Next bar */}
      <div className="grid grid-cols-2 border-b border-border">
        <button
          type="button"
          aria-label={t("remote.service.prev_item")}
          onClick={() => sendCmd("service.prev_item", {})}
          className={cn(
            "flex items-center justify-center gap-2 py-4 text-sm font-medium",
            "text-fg hover:bg-surface-2 active:bg-surface-2 transition-colors",
            "border-r border-border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          ◀ {t("remote.service.prev_item")}
        </button>
        <button
          type="button"
          aria-label={t("remote.service.next_item")}
          onClick={() => sendCmd("service.next_item", {})}
          className={cn(
            "flex items-center justify-center gap-2 py-4 text-sm font-medium",
            "text-fg hover:bg-surface-2 active:bg-surface-2 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          {t("remote.service.next_item")} ▶
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        <ul>
          {service.items.map((item, index) => {
            const isActive = service.activeIndex >= 0 && index === service.activeIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => sendCmd("service.goto", { index })}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors",
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-surface-2 active:bg-surface-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                    )}
                    <div className={cn(!isActive && "pl-4")}>
                      <p className={cn("text-sm font-medium", isActive ? "text-primary" : "text-fg")}>
                        {item.title}
                      </p>
                      <p className="text-xs text-fg-muted capitalize">{item.type}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
