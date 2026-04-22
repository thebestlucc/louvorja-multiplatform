import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import type { TimerMode } from "../../lib/bindings";
import type { TimerAlertRule } from "../../lib/timer-alerts";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { TimerDisplay } from "../../components/utilities/timer-display";
import { cn } from "../../lib/utils";
import { TimerConfigPanel } from "./_timer-config-panel";
import { TimerAlertPanel } from "./_timer-alert-panel";
import { formatUtilityTimer } from "../../types/utilities";

export interface TimerLayoutProps {
  // Mode
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  displayMode: TimerMode;
  displayTimeMs: number;
  // Countdown config
  countdownMinutesValue: string;
  countdownSecondsValue: string;
  isCountdownRuntime: boolean;
  isAdjustPending: boolean;
  onMinutesChange: (value: string) => void;
  onSecondsChange: (value: string) => void;
  onAdjustMinutes: (delta: number) => void;
  // Timer state
  isRunning: boolean;
  hasProgress: boolean;
  laps: number[];
  // Button pending states
  isStartPending: boolean;
  isPausePending: boolean;
  isResumePending: boolean;
  isResetPending: boolean;
  isLapPending: boolean;
  // Handlers
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onLap: () => void;
  // Projection
  isProjecting: boolean;
  onStartProjection: () => void;
  onStopProjection: () => void;
  // Alert panel
  alertRules: TimerAlertRule[];
  alertVolume: number;
  newAlertMinute: string;
  onAlertVolumeChange: (value: number[]) => void;
  onAlertVolumeCommit: (value: number[]) => void;
  onBrowseAlertAudio: (minuteMark: number) => void;
  onClearAlertAudio: (minuteMark: number) => void;
  onTestAlert: (rule: TimerAlertRule) => void;
  onAddAlertMinute: () => void;
  onRemoveAlertMinute: (minuteMark: number) => void;
  onNewAlertMinuteChange: (value: string) => void;
}

export function TimerLayout({
  mode,
  onModeChange,
  displayMode,
  displayTimeMs,
  countdownMinutesValue,
  countdownSecondsValue,
  isCountdownRuntime,
  isAdjustPending,
  onMinutesChange,
  onSecondsChange,
  onAdjustMinutes,
  isRunning,
  hasProgress,
  laps,
  isStartPending,
  isPausePending,
  isResumePending,
  isResetPending,
  isLapPending,
  onStart,
  onPause,
  onResume,
  onReset,
  onLap,
  isProjecting,
  onStartProjection,
  onStopProjection,
  alertRules,
  alertVolume,
  newAlertMinute,
  onAlertVolumeChange,
  onAlertVolumeCommit,
  onBrowseAlertAudio,
  onClearAlertAudio,
  onTestAlert,
  onAddAlertMinute,
  onRemoveAlertMinute,
  onNewAlertMinuteChange,
}: TimerLayoutProps) {
  const { t } = useTranslation();

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <CardTitle>{t("utilities.timer.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("utilities.timer.description")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ModeButton
              active={mode === "countdown"}
              onClick={() => onModeChange("countdown")}
              label={t("utilities.timer.countdown")}
            />
            <ModeButton
              active={mode === "stopwatch"}
              onClick={() => onModeChange("stopwatch")}
              label={t("utilities.timer.stopwatch")}
            />
          </div>

          {mode === "countdown" && (
            <TimerConfigPanel
              countdownMinutesValue={countdownMinutesValue}
              countdownSecondsValue={countdownSecondsValue}
              isRunning={isRunning}
              isCountdownRuntime={isCountdownRuntime}
              isPending={isAdjustPending}
              onMinutesChange={onMinutesChange}
              onSecondsChange={onSecondsChange}
              onAdjustMinutes={onAdjustMinutes}
            />
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background px-4 py-6 text-center">
            <TimerDisplay timeMs={displayTimeMs} mode={displayMode} size="large" />
            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
              {displayMode === "countdown" ? t("utilities.timer.countdown") : t("utilities.timer.stopwatch")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onStart} disabled={isStartPending}>
              <Play className="mr-2 h-4 w-4" />
              {t("utilities.timer.start")}
            </Button>
            <Button size="sm" variant="outline" onClick={onPause} disabled={!isRunning || isPausePending}>
              <Pause className="mr-2 h-4 w-4" />
              {t("utilities.timer.pause")}
            </Button>
            <Button size="sm" variant="outline" onClick={onResume} disabled={isRunning || !hasProgress || isResumePending}>
              <Play className="mr-2 h-4 w-4" />
              {t("utilities.timer.resume")}
            </Button>
            <Button size="sm" variant="outline" onClick={onReset} disabled={isResetPending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("utilities.timer.reset")}
            </Button>
            <Button size="sm" variant="outline" onClick={onLap} disabled={!isRunning || displayMode !== "stopwatch" || isLapPending}>
              <TimerReset className="mr-2 h-4 w-4" />
              {t("utilities.timer.lap")}
            </Button>
            <Button
              size="sm"
              variant={isProjecting ? "destructive" : "outline"}
              onClick={() => {
                if (isProjecting) {
                  onStopProjection();
                  return;
                }
                onStartProjection();
              }}
            >
              {isProjecting ? t("utilities.projection.clear") : t("utilities.projection.project")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("utilities.timer.laps")}</CardTitle>
          </CardHeader>
          <CardContent>
            {laps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("utilities.timer.noLaps")}</p>
            ) : (
              <ol className="space-y-2">
                {[...laps].reverse().map((lap, index) => {
                  const lapNumber = laps.length - index;
                  return (
                    <li
                      key={`${lap}-${lapNumber}`}
                      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">#{lapNumber}</span>
                      <span className="font-medium tabular-nums">
                        {formatUtilityTimer(lap, "stopwatch")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <TimerAlertPanel
          alertRules={alertRules}
          alertVolume={alertVolume}
          newAlertMinute={newAlertMinute}
          onAlertVolumeChange={onAlertVolumeChange}
          onAlertVolumeCommit={onAlertVolumeCommit}
          onBrowseAlertAudio={onBrowseAlertAudio}
          onClearAlertAudio={onClearAlertAudio}
          onTestAlert={onTestAlert}
          onAddAlertMinute={onAddAlertMinute}
          onRemoveAlertMinute={onRemoveAlertMinute}
          onNewAlertMinuteChange={onNewAlertMinuteChange}
        />
      </div>
    </section>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

export function normalizeProjectedTimerValue(mode: TimerMode, valueMs: number): number {
  const safeValueMs = Math.max(0, Math.floor(valueMs));
  if (mode === "countdown") {
    return Math.floor(safeValueMs / 1000) * 1000;
  }
  return safeValueMs;
}
