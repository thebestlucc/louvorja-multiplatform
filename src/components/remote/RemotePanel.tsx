import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Play, Square, QrCode } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import {
  useRemoteStatus,
  useStartRemoteServer,
  useStopRemoteServer,
} from "../../lib/queries/remote";
import { queryKeys } from "../../lib/queries/keys";
import { PairedDevicesList } from "./PairedDevicesList";
import { RemotePairingDialog } from "./RemotePairingDialog";
import type { RemoteStatus } from "../../lib/bindings";

export interface RemotePanelProps {
  className?: string;
}

interface PairingRequestPayload {
  deviceId: string;
  name: string;
}

export function RemotePanel({ className }: RemotePanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: status } = useRemoteStatus();
  const startMutation = useStartRemoteServer();
  const stopMutation = useStopRemoteServer();

  const [pairingDialogOpen, setPairingDialogOpen] = useState(false);

  const isRunning = status?.running ?? false;
  const serverUrl =
    status?.running && status.ip ? `http://${status.ip}:${status.port}` : null;

  // Invalidate status when server emits state changes.
  useEffect(() => {
    const unlisten = listen<RemoteStatus>("remote-server-status", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.status });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  // Invalidate devices list on device changes.
  useEffect(() => {
    const unlisten = listen("remote-devices-changed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.devices });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  // Show approval toast on pairing requests.
  useEffect(() => {
    const unlisten = listen<PairingRequestPayload>(
      "remote-pairing-request",
      (event) => {
        const { name } = event.payload;
        toast(t("remote.desktop_ui.pairing_request_title"), {
          description: t("remote.desktop_ui.pairing_request_body", { name }),
          action: {
            label: t("remote.desktop_ui.pairing_approve"),
            onClick: () => {
              queryClient.invalidateQueries({
                queryKey: queryKeys.remote.devices,
              });
            },
          },
          cancel: {
            label: t("remote.desktop_ui.pairing_deny"),
            onClick: () => {},
          },
          duration: Infinity,
        });
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient, t]);

  const handleStart = () => {
    startMutation.mutate(undefined);
  };

  const handleStop = () => {
    stopMutation.mutate(undefined);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Smartphone
          className={cn(
            "h-5 w-5",
            isRunning ? "text-primary" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <h2 className="text-lg font-medium">
          {t("remote.desktop_ui.panel_title")}
        </h2>
      </div>

      {/* Server controls */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          {/* Status badge */}
          <span
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs",
              isRunning
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            {isRunning && serverUrl
              ? t("remote.desktop_ui.server_status_running", {
                  url: serverUrl,
                })
              : t("remote.desktop_ui.server_status_stopped")}
          </span>

          {/* Start / stop button */}
          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              disabled={stopMutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
              aria-label={t("remote.desktop_ui.server_stop")}
            >
              <Square className="h-3 w-3" aria-hidden="true" />
              {t("remote.desktop_ui.server_stop")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              aria-label={t("remote.desktop_ui.server_start")}
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              {t("remote.desktop_ui.server_start")}
            </button>
          )}
        </div>

        {/* QR pairing button — only shown while server is running */}
        {isRunning && (
          <button
            type="button"
            onClick={() => setPairingDialogOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
            aria-label={t("remote.desktop_ui.show_qr")}
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            {t("remote.desktop_ui.pair_new_device")}
          </button>
        )}
      </section>

      {/* Paired devices */}
      <section className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("remote.desktop_ui.paired_devices")}
        </p>
        <PairedDevicesList />
      </section>

      {/* Pairing dialog */}
      <RemotePairingDialog
        open={pairingDialogOpen}
        onOpenChange={setPairingDialogOpen}
      />
    </div>
  );
}
