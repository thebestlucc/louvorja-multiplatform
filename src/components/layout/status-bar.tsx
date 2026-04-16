import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListChecks, Loader2, Timer, Wifi, Smartphone } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { ProjectorControls } from "../display/projector-controls";
import { SlidePasserIndicator } from "../slide-passer/slide-passer-indicator";
import { StatusBarUpdateIndicator } from "./status-bar-update-indicator";
import { StreamingControls } from "../streaming/streaming-controls";
import { RemoteControlPanel } from "../remote/remote-control-panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useLiturgy, useStreamingStatus, useTimerState, useRemoteStatus } from "../../lib/queries";
import { queryKeys } from "../../lib/queries/keys";
import { formatUtilityTimer } from "../../types/utilities";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { useDownloadStore } from "../../stores/download-store";
import { usePresentationStore } from "../../stores/presentation-store";
import { cn } from "../../lib/utils";
import type { RemoteStatus } from "../../lib/bindings";

export function StatusBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const [streamingOpen, setStreamingOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [version, setVersion] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);
  const { data: status } = useStreamingStatus();
  const { data: remoteStatus } = useRemoteStatus();
  const { data: timerState } = useTimerState();

  // Subscribe to remote-server-status event — no polling.
  useEffect(() => {
    const unlisten = listen<RemoteStatus>("remote-server-status", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.remote.status });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);
  const contentSyncProgress = useContentSyncStore((s) => s.progress);
  const packSyncProgress = useContentSyncStore((s) => s.packSyncProgress);
  const openPackSyncProgress = useContentSyncStore((s) => s.openPackSyncProgress);
  const packSyncRunning = packSyncProgress != null &&
    (packSyncProgress.status === "pending" || packSyncProgress.status === "running");

  // Download indicator state — select the record (stable ref), derive array outside selector
  const downloads = useDownloadStore((s) => s.downloads);
  const downloadEntries = Object.values(downloads);
  const firstDownload = downloadEntries[0];

  // Active liturgy state
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const { data: activeLiturgyData } = useLiturgy(activeLiturgyId ?? 0);
  const activeServiceTitle = activeLiturgyData?.service?.title ?? null;

  const isRunning = status?.isRunning ?? false;
  const hasTimerProgress = Boolean(
    timerState
      && (
        timerState.isRunning
        || timerState.currentTimeMs > 0
        || (
          timerState.mode === "countdown"
          && timerState.durationMs != null
          && timerState.currentTimeMs < timerState.durationMs
        )
      ),
  );
  const timerLabel = hasTimerProgress && timerState
    ? formatUtilityTimer(timerState.currentTimeMs, timerState.mode)
    : null;

  // Hide sync indicator when on settings route (full progress card is visible there)
  const isOnSettings = routerState.location.pathname.startsWith("/settings");
  const contentSyncRunning = contentSyncProgress
    && ["pending", "running"].includes(contentSyncProgress.status);
  const showContentSyncIndicator = Boolean(contentSyncRunning && !isOnSettings);

  const truncatedTitle = activeServiceTitle
    ? activeServiceTitle.length > 12
      ? activeServiceTitle.slice(0, 12) + "..."
      : activeServiceTitle
    : null;

  return (
    <footer data-tour="status-bar" className="flex h-11 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-xs text-muted-foreground">
      <span>
        {t("status.ready")}
        {version ? <span className="ml-2 opacity-60">v{version}</span> : null}
      </span>

      <div className="flex items-center gap-1">
        {activeLiturgyId !== null && truncatedTitle && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() =>
                    navigate({
                      to: "/services/$serviceId",
                      params: { serviceId: String(activeLiturgyId) },
                    })
                  }
                  className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-green-500 hover:bg-surface-hover"
                  aria-label={t("services.activeServiceIndicator")}
                >
                  <ListChecks className="size-3.75" />
                  <span>{truncatedTitle}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("services.activeServiceIndicator")}</TooltipContent>
            </Tooltip>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        {packSyncRunning && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openPackSyncProgress}
                  className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-sky-400 hover:bg-surface-hover"
                  aria-label={t("settings.packSync.progressTitle")}
                >
                  <Loader2 className="size-3.75 animate-spin" />
                  <span>
                    {t("settings.packSync.statusBar", {
                      current: packSyncProgress!.packsProcessed,
                      total: packSyncProgress!.packsTotal,
                    })}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("settings.packSync.progressTitle")}</TooltipContent>
            </Tooltip>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        {downloadEntries.length > 0 && firstDownload && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() =>
                    navigate({
                      to: "/collections",
                      search: { tab: "online-videos", playlist: firstDownload.playlistId },
                    })
                  }
                  className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-sky-400 hover:bg-surface-hover"
                  aria-label={t("onlineVideos.detail.downloading")}
                >
                  <Loader2 className="size-3.75 animate-spin" />
                  <span>
                    {downloadEntries.length > 1
                      ? `${downloadEntries.length} downloads`
                      : `${Math.round(firstDownload.progress)}%`}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("onlineVideos.detail.downloading")}</TooltipContent>
            </Tooltip>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        {showContentSyncIndicator && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate({ to: "/settings", search: { tab: "sync" } })}
                  className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-emerald-400 hover:bg-surface-hover"
                  aria-label={t("settings.contentSync.title")}
                >
                  <Loader2 className="size-3.75 animate-spin" />
                  <span>
                    {t("settings.contentSync.statusBar", {
                      current: contentSyncProgress?.itemsProcessed ?? 0,
                      total: contentSyncProgress?.itemsTotal ?? 0,
                    })}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("settings.contentSync.title")}</TooltipContent>
            </Tooltip>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate({ to: "/utilities/timer" })}
              className={cn(
                "flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-surface-hover",
                hasTimerProgress && "text-foreground",
              )}
              aria-label={t("status.timerOpen")}
            >
              <Timer className={cn("size-3.75", timerState?.isRunning && "text-green-500")} />
              <span>
                {timerLabel
                  ? t("status.timerCompact", { value: timerLabel })
                  : t("status.timerIdle")}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("status.timerOpen")}</TooltipContent>
        </Tooltip>
        <div className="mx-1 h-4 w-px bg-border" />
        <SlidePasserIndicator />
        <div className="mx-1 h-4 w-px bg-border" />
        <ProjectorControls />
        <div className="mx-1 h-4 w-px bg-border" />
        <StatusBarUpdateIndicator />
        <div className="mx-1 h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setRemoteOpen(true)}
              className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-surface-hover"
              aria-label={t("status.remoteOpen")}
            >
              <Smartphone className={cn("size-3.75", remoteStatus?.running && "text-primary")} />
              {remoteStatus?.running
                ? t("status.remoteOn", { count: remoteStatus.connections })
                : t("status.remoteOff")}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("remoteControl.panelTitle")}</TooltipContent>
        </Tooltip>
        <div className="mx-1 h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setStreamingOpen(true)}
              className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-surface-hover"
              aria-label={t("streaming.title")}
            >
              <Wifi className={cn("size-3.75", isRunning && "text-green-500")} />
              {isRunning
                ? t("status.streamingOn", {
                  port: status?.port ?? 7070,
                  count: status?.connections ?? 0,
                })
                : t("status.streamingOff")}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("streaming.title")}</TooltipContent>
        </Tooltip>
      </div>

      <Dialog open={remoteOpen} onOpenChange={setRemoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("remoteControl.panelTitle")}</DialogTitle>
          </DialogHeader>
          <RemoteControlPanel />
        </DialogContent>
      </Dialog>

      <Dialog open={streamingOpen} onOpenChange={setStreamingOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("streaming.title")}</DialogTitle>
          </DialogHeader>
          <StreamingControls />
        </DialogContent>
      </Dialog>
    </footer>
  );
}
