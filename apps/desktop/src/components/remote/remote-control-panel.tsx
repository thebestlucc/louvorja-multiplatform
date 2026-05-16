import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Play, Square, QrCode, Trash2, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listen } from "@tauri-apps/api/event";
import { notify } from "../../lib/notifications";
import { cn } from "../../lib/utils";
import {
  useRemoteStatus,
  useStartRemoteServer,
  useStopRemoteServer,
  useBeginPairing,
  useCancelPairing,
  usePairedDevices,
  useRevokePairedDevice,
} from "../../lib/queries/remote";
import type { RemoteStatus, PairingInfo } from "../../lib/bindings";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queries/keys";

export interface RemoteControlPanelProps {
  className?: string;
}

export function RemoteControlPanel({ className }: RemoteControlPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: status } = useRemoteStatus();
  const startMutation = useStartRemoteServer();
  const stopMutation = useStopRemoteServer();
  const beginPairing = useBeginPairing();
  const cancelPairing = useCancelPairing();
  const { data: devices } = usePairedDevices();
  const revoke = useRevokePairedDevice();

  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const isRunning = status?.running ?? false;
  const serverUrl = status?.running && status.ip
    ? `http://${status.ip}:${status.port}`
    : null;

  // Subscribe to remote-server-status events (no polling).
  useEffect(() => {
    const unlisten = listen<RemoteStatus>("remote-server-status", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.status });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);

  // Subscribe to remote-devices-changed events.
  useEffect(() => {
    const unlisten = listen("remote-devices-changed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.devices });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);

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
          setPairingInfo(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pairingInfo]);

  const handleStart = () => {
    startMutation.mutate(undefined, {
      onSuccess: () => notify.success(t("remoteControl.serverStart")),
      onError: () => notify.error(t("remoteControl.serverStart")),
    });
  };

  const handleStop = () => {
    if (pairingInfo) {
      cancelPairing.mutate(undefined);
      setPairingInfo(null);
    }
    stopMutation.mutate(undefined, {
      onSuccess: () => notify.success(t("remoteControl.serverStop")),
    });
  };

  const handleShowQr = () => {
    beginPairing.mutate(undefined, {
      onSuccess: (info) => setPairingInfo(info),
      onError: () => notify.error(t("remoteControl.showQr")),
    });
  };

  const handleCancelPairing = () => {
    cancelPairing.mutate(undefined);
    setPairingInfo(null);
  };

  const handleRevoke = (id: string) => {
    revoke.mutate(id);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Server controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Smartphone className={cn("h-4 w-4", isRunning ? "text-primary" : "text-muted-foreground")} />
          <span className="text-sm font-medium">{t("remoteControl.panelTitle")}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={stopMutation.isPending}
              className="flex items-center gap-1.5 rounded bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              <Square className="h-3 w-3" />
              {t("remoteControl.serverStop")}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {t("remoteControl.serverStart")}
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {isRunning && serverUrl && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {t("remoteControl.serverStatusRunning", { url: serverUrl })}
        </div>
      )}
      {!isRunning && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("remoteControl.serverStatusStopped")}
        </div>
      )}

      {/* QR Pairing */}
      {isRunning && (
        <div className="space-y-2">
          {pairingInfo ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-border p-3">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={pairingInfo.url} size={160} />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {t("remoteControl.qrExpires", { seconds: secondsLeft })}
                </p>
                <p className="mt-1 text-xs font-medium">
                  {t("remoteControl.pinLabel")}: <span className="font-mono text-base tracking-widest">{pairingInfo.pin}</span>
                </p>
              </div>
              <button
                onClick={handleCancelPairing}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("remoteControl.pairingDeny")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleShowQr}
              disabled={beginPairing.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              {beginPairing.isPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                t("remoteControl.pairNewDevice")
              )}
            </button>
          )}
        </div>
      )}

      {/* Paired devices */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t("remoteControl.pairedDevices")}</p>
        {!devices || devices.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("remoteControl.noDevices")}</p>
        ) : (
          <ul className="space-y-1">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{device.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {device.lastSeenAt
                      ? t("remoteControl.lastSeen", { time: new Date(device.lastSeenAt * 1000).toLocaleString() })
                      : t("remoteControl.neverSeen")}
                  </span>
                </div>
                <button
                  onClick={() => handleRevoke(device.id)}
                  disabled={revoke.isPending}
                  className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={t("remoteControl.revokeDevice")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
