import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Timer, Wifi } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { ProjectorControls } from "../display/projector-controls";
import { StatusBarUpdateIndicator } from "./status-bar-update-indicator";
import { StreamingControls } from "../streaming/streaming-controls";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useStreamingStatus, useTimerState } from "../../lib/queries";
import { formatUtilityTimer } from "../../types/utilities";
import { useContentSyncStore } from "../../stores/content-sync-store";
import { useLegacyFetchStore } from "../../stores/legacy-fetch-store";
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
  const legacyFetchProgress = useLegacyFetchStore((s) => s.progress);
  const contentSyncProgress = useContentSyncStore((s) => s.progress);
  
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
  const isSyncing = legacyFetchProgress && 
    ["fetching", "importing", "downloading"].includes(legacyFetchProgress.status);
  const showSyncIndicator = isSyncing && !isOnSettings;
  const contentSyncRunning = contentSyncProgress
    && ["pending", "running"].includes(contentSyncProgress.status);
  const showContentSyncIndicator = Boolean(contentSyncRunning && !isOnSettings);

  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-muted-foreground">
      <span>
        {t("status.ready")}
        {version ? <span className="ml-2 opacity-60">v{version}</span> : null}
      </span>

      <div className="flex items-center gap-3">
        {showContentSyncIndicator && (
          <button
            onClick={() => navigate({ to: "/settings", search: { tab: "sync" } })}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-emerald-400 hover:bg-white/10"
            title={t("settings.contentSync.title")}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {t("settings.contentSync.statusBar", {
                current: contentSyncProgress?.itemsProcessed ?? 0,
                total: contentSyncProgress?.itemsTotal ?? 0,
              })}
            </span>
          </button>
        )}
        {showSyncIndicator && (
          <button
            onClick={() => navigate({ to: "/settings", search: { tab: "migration" } })}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-blue-400 hover:bg-white/10"
            title={t("settings.legacyFetch.progressTitle")}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {t("settings.legacyFetch.syncIndicator.label")}{" "}
              {t("settings.legacyFetch.syncIndicator.progress", {
                current: legacyFetchProgress?.itemsProcessed ?? 0,
                total: legacyFetchProgress?.itemsTotal ?? 0,
              })}
            </span>
          </button>
        )}
        <button
          onClick={() => navigate({ to: "/utilities/timer" })}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10",
            hasTimerProgress && "text-foreground",
          )}
          title={t("status.timerOpen")}
        >
          <Timer className={cn("h-3 w-3", timerState?.isRunning && "text-green-500")} />
          <span>
            {timerLabel
              ? t("status.timerCompact", { value: timerLabel })
              : t("status.timerIdle")}
          </span>
        </button>
        <ProjectorControls />
        <StatusBarUpdateIndicator />
        <button
          onClick={() => setStreamingOpen(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10"
        >
          <Wifi className={cn("h-3 w-3", isRunning && "text-green-500")} />
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
