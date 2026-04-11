import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useSlidePasserStore } from "../../stores/slide-passer-store";
import { cn } from "../../lib/utils";

interface TestClickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DetectedKey {
  key: string;
  action: string | null;
  id: number;
}

export function TestClickerDialog({ open, onOpenChange }: TestClickerDialogProps) {
  const { t } = useTranslation();
  const [detectedKeys, setDetectedKeys] = useState<DetectedKey[]>([]);
  const idCounter = useRef(0);
  const mappings = useSlidePasserStore((s) => s.config.mappings);

  const findAction = useCallback(
    (key: string): string | null => {
      for (const [action, mappedKey] of Object.entries(mappings)) {
        if (mappedKey === key) return action;
      }
      return null;
    },
    [mappings],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return;

      const action = findAction(e.key);
      idCounter.current += 1;
      setDetectedKeys((prev) => [
        { key: e.key, action, id: idCounter.current },
        ...prev.slice(0, 19),
      ]);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, findAction]);

  useEffect(() => {
    if (!open) setDetectedKeys([]);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("slidePasser.testClicker")}</DialogTitle>
        </DialogHeader>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("slidePasser.testClickerDesc")}
        </p>

        <div className="max-h-60 min-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4">
          {detectedKeys.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("slidePasser.testClickerWaiting")}
            </p>
          ) : (
            <div className="space-y-2">
              {detectedKeys.map((dk, i) => (
                <div
                  key={dk.id}
                  className={cn(
                    "flex items-center justify-between rounded px-3 py-2 text-sm",
                    i === 0 ? "bg-primary/10" : "bg-transparent",
                  )}
                >
                  <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                    {dk.key}
                  </kbd>
                  {dk.action ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="h-3.5 w-3.5" />
                      {t(`slidePasser.mappings.${dk.action}`)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                      {t("slidePasser.unmapped")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
