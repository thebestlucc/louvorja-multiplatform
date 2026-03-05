import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Play, Radio, Square, Wifi } from "lucide-react";
import { notify } from "../../lib/notifications";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import { copyToClipboard } from "../../lib/clipboard";
import { useStreamingStatus, useStartStreaming, useStopStreaming, useSetStreamingBroadcast } from "../../lib/queries";
import { QrCodeDisplay } from "./qr-code-display";
import { cn } from "../../lib/utils";

export function StreamingControls() {
  const { t } = useTranslation();
  const [port, setPort] = useState("7070");
  const { data: status } = useStreamingStatus();
  const startMutation = useStartStreaming();
  const stopMutation = useStopStreaming();
  const broadcastMutation = useSetStreamingBroadcast();

  const isRunning = status?.isRunning ?? false;
  const broadcastEnabled = status?.broadcastEnabled ?? true;
  const portNumber = Number(port);
  const isValidPort = Number.isInteger(portNumber) && portNumber >= 1024 && portNumber <= 65535;

  const handleStart = () => {
    if (!isValidPort) {
      notify.error(t("streaming.invalidPort"));
      return;
    }

    startMutation.mutate(portNumber, {
      onSuccess: () => notify.success(t("streaming.started")),
      onError: (error) => notify.tauriError(error, t("streaming.startFailed")),
    });
  };

  const handleStop = () => {
    stopMutation.mutate(undefined, {
      onSuccess: () => notify.success(t("streaming.stopped")),
      onError: (error) => notify.tauriError(error, t("streaming.stopFailed")),
    });
  };

  const handleToggleBroadcast = () => {
    broadcastMutation.mutate(!broadcastEnabled);
  };

  const copyUrl = async (url: string) => {
    try {
      await copyToClipboard(url);
      notify.success(t("streaming.urlCopied"));
    } catch {
      notify.error(t("streaming.copyFailed"));
    }
  };

  const openUrl = async (url: string) => {
    try {
      await tauriOpenUrl(url);
    } catch {
      notify.error(t("streaming.openFailed"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Server controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Wifi className={cn("h-4 w-4", isRunning ? "text-green-500" : "text-muted-foreground")} />
          <span className="text-sm font-medium">
            {t("streaming.server")}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {!isRunning && (
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className={cn(
                "h-7 w-20 rounded border bg-surface px-2 text-xs",
                isValidPort ? "border-border" : "border-red-500/70",
              )}
              min={1024}
              max={65535}
            />
          )}
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={stopMutation.isPending}
              className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Square className="h-3 w-3" />
              {t("streaming.stop")}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending || !isValidPort}
              className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {t("streaming.start")}
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {isRunning && status?.ip && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
          {t("streaming.runningOn", { ip: status.ip, port: status.port })}
          {" — "}
          {t("streaming.connections", { count: status.connections })}
        </div>
      )}

      {!isRunning && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("streaming.notRunning")}
        </div>
      )}

      {/* Broadcast toggle */}
      {isRunning && (
        <button
          onClick={handleToggleBroadcast}
          disabled={broadcastMutation.isPending}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50",
            broadcastEnabled
              ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
              : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
          )}
        >
          <Radio className={cn("h-3.5 w-3.5", broadcastEnabled ? "text-green-400" : "text-muted-foreground")} />
          {broadcastEnabled ? t("streaming.broadcastEnabled") : t("streaming.broadcastDisabled")}
        </button>
      )}

      {/* QR Codes & URLs */}
      {isRunning && status?.urls && (
        <div className="grid grid-cols-3 gap-4">
          {([
            { key: "music", url: status.urls.music, label: t("streaming.musicLyrics") },
            { key: "bible", url: status.urls.bible, label: t("streaming.bible") },
            { key: "return", url: status.urls.returnMonitor, label: t("streaming.returnMonitor") },
          ] as const).map((item) => (
            <div key={item.key} className="flex flex-col items-center gap-1">
              <QrCodeDisplay url={item.url} label={item.label} />
              <div className="flex gap-1">
                <button
                  onClick={() => void copyUrl(item.url)}
                  className="rounded p-1 hover:bg-white/10"
                  title={t("streaming.copyUrl")}
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  onClick={() => void openUrl(item.url)}
                  className="rounded p-1 hover:bg-white/10"
                  title={t("streaming.openInBrowser")}
                >
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
