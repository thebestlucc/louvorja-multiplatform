import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pointer, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useSlidePasserStore } from "../../stores/slide-passer-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ToggleButton } from "../settings/toggle-button";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

export function SlidePasserIndicator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const config = useSlidePasserStore((s) => s.config);
  const isActive = useSlidePasserStore((s) => s.isActive);
  const lastEventKey = useSlidePasserStore((s) => s.lastEventKey);
  const lastEventTimestamp = useSlidePasserStore((s) => s.lastEventTimestamp);
  const setEnabled = useSlidePasserStore((s) => s.setEnabled);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const lastEventLabel = lastEventTimestamp
    ? new Date(lastEventTimestamp).toLocaleTimeString()
    : null;

  function handleToggle() {
    const next = !config.enabled;
    setEnabled(next);
    toast(
      next ? t("slidePasser.toast.enabled") : t("slidePasser.toast.disabled"),
      { duration: 2000 },
    );
  }

  // Close on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [popoverOpen]);

  return (
    <div className="relative inline-flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setPopoverOpen(!popoverOpen)}
            className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-surface-hover"
            aria-label={t("slidePasser.statusLabel")}
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
          >
            <Pointer
              className={cn(
                "size-3.75 transition-colors",
                config.enabled
                  ? isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                  : "text-muted-foreground/40",
              )}
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {config.enabled
            ? t("slidePasser.title") + " (ON)"
            : t("slidePasser.title") + " (OFF)"}
        </TooltipContent>
      </Tooltip>

      {popoverOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-border bg-surface p-3 shadow-lg"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("slidePasser.title")}</span>
              <ToggleButton
                checked={config.enabled}
                onClick={handleToggle}
                ariaLabel={t("slidePasser.enable")}
              />
            </div>

            {config.enabled && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  {t("slidePasser.mode")}:{" "}
                  {t(
                    config.mode === "internal"
                      ? "slidePasser.modeInternal"
                      : "slidePasser.modeExternal",
                  )}
                </div>
                <div>
                  {t("slidePasser.mappedKeys")}:{" "}
                  {Object.values(config.mappings).filter(Boolean).length}
                </div>
                {lastEventLabel && lastEventKey && (
                  <div>
                    {t("slidePasser.lastEvent")}:{" "}
                    <kbd className="rounded border border-border px-1 font-mono">
                      {lastEventKey}
                    </kbd>{" "}
                    @ {lastEventLabel}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setPopoverOpen(false);
                void navigate({ to: "/settings", search: { tab: "slide-passer" } });
              }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Settings className="h-3 w-3" aria-hidden="true" />
              {t("slidePasser.openSettings")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
