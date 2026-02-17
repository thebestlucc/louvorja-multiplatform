import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Timer, Wifi } from "lucide-react";
import { ProjectorControls } from "../display/projector-controls";
import { StreamingControls } from "../streaming/streaming-controls";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useStreamingStatus, useTimerState } from "../../lib/queries";
import { formatUtilityTimer } from "../../types/utilities";
import { cn } from "../../lib/utils";

export function StatusBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [streamingOpen, setStreamingOpen] = useState(false);
  const { data: status } = useStreamingStatus();
  const { data: timerState } = useTimerState();
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

  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-muted-foreground">
      <span>{t("status.ready")}</span>

      <div className="flex items-center gap-3">
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
