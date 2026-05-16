import { useTranslation } from "react-i18next";
import { Smartphone, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface PairingToastProps {
  open: boolean;
  pairingCode: string;
  hostUrl: string;
  onDismiss: () => void;
  className?: string;
}

export function PairingToast({ open, pairingCode, hostUrl, onDismiss, className }: PairingToastProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const digits = pairingCode.padEnd(6, " ").slice(0, 6).split("");

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 w-[360px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-primary/8 px-4 py-3">
        <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-primary">
          {t("remoteControl.toast.title")}
        </span>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label={t("actions.close")}
            className="h-6 w-6"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2 px-4 py-3">
        {/* Step 1 */}
        <p className="text-xs text-muted-foreground">
          {t("remoteControl.toast.step1_prefix")}{" "}
          <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
            {hostUrl}/pair
          </code>{" "}
          {t("remoteControl.toast.step1_suffix")}
        </p>

        {/* Step 2 */}
        <p className="text-xs text-muted-foreground">
          {t("remoteControl.toast.step2")}
        </p>

        {/* Code digits */}
        <div className="mt-2 flex justify-center gap-1.5">
          {digits.map((digit, i) => (
            <div
              key={i}
              className="flex h-11 w-9 items-center justify-center rounded-md border border-border bg-surface-hover font-mono text-lg font-bold text-foreground"
            >
              {digit.trim() ? digit : "–"}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-surface-hover px-4 py-2 text-[11px] text-muted-foreground">
        {t("remoteControl.toast.footer")}
      </div>
    </div>
  );
}
