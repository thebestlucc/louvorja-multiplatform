import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface KeyCaptureProps {
  onCapture: (key: string) => void;
  onCancel: () => void;
}

export function KeyCapture({ onCapture, onCancel }: KeyCaptureProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return;

      // Escape closes the dialog instead of capturing
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      onCapture(e.key);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onCapture]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("slidePasser.captureTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="animate-pulse text-4xl">
            <kbd className="rounded-lg border-2 border-primary bg-muted px-6 py-3 font-mono text-lg">
              ?
            </kbd>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t("slidePasser.captureDesc")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
