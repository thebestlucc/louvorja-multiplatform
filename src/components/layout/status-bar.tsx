import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListChecks, Loader2, Timer, Wifi } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { ProjectorControls } from "../display/projector-controls";
import { StatusBarUpdateIndicator } from "./status-bar-update-indicator";
import { StreamingControls } from "../streaming/streaming-controls";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useLiturgy, useStreamingStatus, useTimerState } from "../../lib/queries";
import { formatUtilityTimer } from "../../types/utilities";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { useDownloadStore } from "../../stores/download-store";
import { usePresentationStore } from "../../stores/presentation-store";
import { cn } from "../../lib/utils";

export function StatusBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const [streamingOpen, setStreamingOpen] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);
  const { data: status } = useStreamingStatus();
  const { data: timerState } = useTimerState();
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
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-xs text-muted-foreground">
      <span>
        {t("status.ready")}
        {version ? <span className="ml-2 opacity-60">v{version}</span> : null}
      </span>

      <div className="flex items-center gap-1">
        {activeLiturgyId !== null && truncatedTitle && (
          <>
            <button
              onClick={() =>
                navigate({
                  to: "/services/$serviceId",
                  params: { serviceId: String(activeLiturgyId) },
                })
              }
              className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-green-500 hover:bg-surface-hover"
              title={t("services.activeServiceIndicator")}
            >
              <ListChecks className="size-3.75" />
              <span>{truncatedTitle}</span>
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        {packSyncRunning && (
          <>
            <button
              onClick={openPackSyncProgress}
              className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-sky-400 hover:bg-surface-hover"
            >
              <Loader2 className="size-3.75 animate-spin" />
              <span>
                {t("settings.packSync.statusBar", {
                  current: packSyncProgress!.packsProcessed,
                  total: packSyncProgress!.packsTotal,
                })}
              </span>
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        {downloadEntries.length > 0 && firstDownload && (
          <>
            <button
              onClick={() =>
                navigate({
                  to: "/collections",
                  search: { tab: "online-videos", playlist: firstDownload.playlistId },
                })
              }
              className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-sky-400 hover:bg-surface-hover"
              title={t("onlineVideos.detail.downloading")}
            >
              <Loader2 className="size-3.75 animate-spin" />
              <span>
                {downloadEntries.length > 1
                  ? `${downloadEntries.length} downloads`
                  : `${Math.round(firstDownload.progress)}%`}
              </span>
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        {showContentSyncIndicator && (
          <>
            <button
              onClick={() => navigate({ to: "/settings", search: { tab: "sync" } })}
              className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 text-emerald-400 hover:bg-surface-hover"
              title={t("settings.contentSync.title")}
            >
              <Loader2 className="size-3.75 animate-spin" />
              <span>
                {t("settings.contentSync.statusBar", {
                  current: contentSyncProgress?.itemsProcessed ?? 0,
                  total: contentSyncProgress?.itemsTotal ?? 0,
                })}
              </span>
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        <button
          onClick={() => navigate({ to: "/utilities/timer" })}
          className={cn(
            "flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-surface-hover",
            hasTimerProgress && "text-foreground",
          )}
          title={t("status.timerOpen")}
        >
          <Timer className={cn("size-3.75", timerState?.isRunning && "text-green-500")} />
          <span>
            {timerLabel
              ? t("status.timerCompact", { value: timerLabel })
              : t("status.timerIdle")}
          </span>
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <ProjectorControls />
        <div className="mx-1 h-4 w-px bg-border" />
        <StatusBarUpdateIndicator />
        <button
          onClick={() => setStreamingOpen(true)}
          className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-surface-hover"
        >
          <Wifi className={cn("size-3.75", isRunning && "text-green-500")} />
          {isRunning
            ? t("status.streamingOn", {
              port: status?.port ?? 7070,
              count: status?.connections ?? 0,
            })
            : t("status.streamingOff")}
        </button>
      </div>

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
