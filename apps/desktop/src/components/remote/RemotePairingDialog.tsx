import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useBeginPairing, useCancelPairing } from "../../lib/queries/remote";
import type { PairingInfo } from "../../lib/bindings";

export interface RemotePairingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemotePairingDialog({ open, onOpenChange }: RemotePairingDialogProps) {
  const { t } = useTranslation();
  const beginPairing = useBeginPairing();
  const cancelPairing = useCancelPairing();

  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Start pairing when dialog opens.
  useEffect(() => {
    if (!open) return;
    setPairingInfo(null);
    beginPairing.mutate(undefined, {
      onSuccess: (info) => setPairingInfo(info),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Countdown timer for QR expiry.
  useEffect(() => {
    if (!pairingInfo) return;
    const now = Math.floor(Date.now() / 1000);
    const remaining = pairingInfo.expiresAt - now;
    setSecondsLeft(Math.max(0, remaining));

    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pairingInfo]);

  const handleClose = () => {
    if (pairingInfo) {
      cancelPairing.mutate(undefined);
      setPairingInfo(null);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("remote.desktop_ui.pair_new_device")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {beginPairing.isPending && (
            <div className="flex h-48 w-48 items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
                aria-label={t("remote.loading" as never, "Loading…")}
              />
            </div>
          )}

          {pairingInfo && (
            <>
              {/* QR code rendered client-side from the pairing URL */}
              <div className="rounded-lg bg-white p-3" aria-label={t("remote.desktop_ui.show_qr")}>
                <QRCodeSVG value={pairingInfo.url} size={192} />
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {t("remoteControl.qrExpires", { seconds: secondsLeft })}
                </p>
                <p className="mt-2 text-sm">
                  {t("remoteControl.pinLabel")}:{" "}
                  <span className="font-mono text-2xl font-bold tracking-widest text-foreground">
                    {pairingInfo.pin}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("remote.pair.find_code_hint")}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t("remote.desktop_ui.pairing_deny")}
              >
                <X className="h-3 w-3" aria-hidden="true" />
                {t("remote.desktop_ui.pairing_deny")}
              </button>
            </>
          )}

          {beginPairing.isError && (
            <div className="text-center text-sm text-destructive">
              {t("remote.errors.generic_title")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
