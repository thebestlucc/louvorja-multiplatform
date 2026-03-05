import { useCallback, useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import {
  useAddLap,
  useAdjustCountdownTimer,
  useAllSettings,
  usePauseTimer,
  useResetTimer,
  useResumeTimer,
  useSetSetting,
  useStartTimer,
  useTimerState,
} from "../../lib/queries";
import { useUtilityProjection } from "../../hooks/use-utility-projection";
import {
  createUtilityProjectionPayload,
  formatUtilityTimer,
} from "../../types/utilities";
import type { TimerMode } from "../../lib/bindings";
import {
  startCountdownProjection,
  startStopwatchProjection,
  stopUtilityProjection,
} from "../../lib/tauri";
import {
  DEFAULT_TIMER_ALERT_VOLUME,
  isMandatoryAlertMinute,
  normalizeAlertVolume,
  parseAlertVolumeSetting,
  normalizeAlertRules,
  parseAlertRulesSetting,
  playTimerAlertRule,
  type TimerAlertRule,
  TIMER_ALERT_VOLUME_SETTING_KEY,
  TIMER_ALERTS_SETTING_KEY,
} from "../../lib/timer-alerts";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Slider } from "../../components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { TimerDisplay } from "../../components/utilities/timer-display";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/utilities/timer")({
  component: UtilitiesTimerPage,
});

const COUNTDOWN_QUICK_ADJUSTMENTS_MINUTES = [-10, -5, -1, 1, 5, 10] as const;
const DEFAULT_COUNTDOWN_MS = 5 * 60_000;

function UtilitiesTimerPage() {
  const { t } = useTranslation();
  const { data: timerState } = useTimerState();
  const { data: allSettings } = useAllSettings();
  const setSettingMutation = useSetSetting();
  const startTimer = useStartTimer();
  const pauseTimer = usePauseTimer();
  const resumeTimer = useResumeTimer();
  const resetTimer = useResetTimer();
  const adjustCountdownTimer = useAdjustCountdownTimer();
  const addLap = useAddLap();
  const { isProjecting, startProjection, stopProjection } = useUtilityProjection("timer");

  const [mode, setMode] = useState<TimerMode>("countdown");
  const [countdownValueMs, setCountdownValueMs] = useState(DEFAULT_COUNTDOWN_MS);
  const [alertRules, setAlertRules] = useState<TimerAlertRule[]>(() => normalizeAlertRules([]));
  const [alertVolume, setAlertVolume] = useState(DEFAULT_TIMER_ALERT_VOLUME);
  const [newAlertMinute, setNewAlertMinute] = useState("2");

  const isRunning = timerState?.isRunning ?? false;
  const laps = timerState?.laps ?? [];
  const currentTimeMs = timerState?.currentTimeMs ?? 0;
  const countdownTotalSeconds = Math.floor(Math.max(0, countdownValueMs) / 1000);
  const countdownMinutesValue = String(Math.floor(countdownTotalSeconds / 60));
  const countdownSecondsValue = String(countdownTotalSeconds % 60);
  const stoppedCountdownRuntimeMs = timerState?.mode === "countdown"
    && timerState.durationMs != null
    && !timerState.isRunning
    ? timerState.currentTimeMs
    : null;

  const hasProgress = Boolean(
    laps.length > 0
      || currentTimeMs > 0
      || (
        timerState?.mode === "countdown"
        && timerState.durationMs != null
        && timerState.currentTimeMs < timerState.durationMs
      ),
  );

  useEffect(() => {
    setAlertRules(parseAlertRulesSetting(allSettings));
  }, [allSettings]);

  useEffect(() => {
    setAlertVolume(parseAlertVolumeSetting(allSettings));
  }, [allSettings]);

  useEffect(() => {
    if (stoppedCountdownRuntimeMs == null) {
      return;
    }
    setCountdownValueMs(stoppedCountdownRuntimeMs);
  }, [stoppedCountdownRuntimeMs]);

  const persistAlertRules = async (nextRules: TimerAlertRule[]) => {
    await catcher(
      setSettingMutation.mutateAsync({
        key: TIMER_ALERTS_SETTING_KEY,
        value: JSON.stringify(nextRules),
      }),
      { notify: true },
    );
  };

  const updateAlertRules = async (updater: (rules: TimerAlertRule[]) => TimerAlertRule[]) => {
    const nextRules = normalizeAlertRules(updater(alertRules));
    setAlertRules(nextRules);
    await persistAlertRules(nextRules);
  };

  const persistAlertVolume = async (nextVolume: number) => {
    await catcher(
      setSettingMutation.mutateAsync({
        key: TIMER_ALERT_VOLUME_SETTING_KEY,
        value: String(normalizeAlertVolume(nextVolume)),
      }),
      { notify: true },
    );
  };

  const handleStart = async () => {
    if (mode === "countdown") {
      const totalSeconds = Math.floor(Math.max(0, countdownValueMs) / 1000);
      if (totalSeconds <= 0) {
        notify.error(t("utilities.timer.durationRequired"));
        return;
      }
      await catcher(
        startTimer.mutateAsync({ mode, durationMs: totalSeconds * 1000 }),
        { notify: true },
      );
    } else {
      await catcher(
        startTimer.mutateAsync({ mode, durationMs: null }),
        { notify: true },
      );
    }
  };

  const handlePause = async () => {
    await catcher(pauseTimer.mutateAsync(), { notify: true });
  };

  const handleResume = async () => {
    await catcher(resumeTimer.mutateAsync(), { notify: true });
  };

  const handleReset = async () => {
    await catcher(resetTimer.mutateAsync(), { notify: true });
  };

  const handleLap = async () => {
    await catcher(addLap.mutateAsync(), { notify: true });
  };

  const handleAdjustCountdownMinutes = async (deltaMinutes: number) => {
    const deltaMs = deltaMinutes * 60_000;
    const hasCountdownRuntime = timerState?.mode === "countdown" && timerState.durationMs != null;
    const baseValueMs = hasCountdownRuntime ? timerState.currentTimeMs : countdownValueMs;
    const nextValueMs = Math.max(0, baseValueMs + deltaMs);

    if (hasCountdownRuntime) {
      const [, error] = await catcher(
        adjustCountdownTimer.mutateAsync({ deltaMs }),
        { notify: true },
      );

      if (!error) {
        setCountdownValueMs(nextValueMs);
      }
      return;
    }

    setCountdownValueMs(nextValueMs);
  };

  const handleMinutesInputChange = (value: string) => {
    const nextMinutes = parseNonNegativeInteger(value);
    const currentSeconds = countdownTotalSeconds % 60;
    setCountdownValueMs((nextMinutes * 60 + currentSeconds) * 1000);
  };

  const handleSecondsInputChange = (value: string) => {
    const nextSeconds = Math.min(59, parseNonNegativeInteger(value));
    const currentMinutes = Math.floor(countdownTotalSeconds / 60);
    setCountdownValueMs((currentMinutes * 60 + nextSeconds) * 1000);
  };

  const handleBrowseAlertAudio = async (minuteMark: number) => {
    const selected = await openFileDialog({
      multiple: false,
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "webm"],
        },
      ],
    });

    if (!selected || typeof selected !== "string") {
      return;
    }

    await updateAlertRules((rules) =>
      rules.map((rule) => (rule.minuteMark === minuteMark ? { ...rule, audioPath: selected } : rule)));
  };

  const handleClearAlertAudio = async (minuteMark: number) => {
    await updateAlertRules((rules) =>
      rules.map((rule) => (rule.minuteMark === minuteMark ? { ...rule, audioPath: null } : rule)));
  };

  const handleTestAlert = async (rule: TimerAlertRule) => {
    await catcher(playTimerAlertRule(rule, alertVolume), {
      notify: true,
      fallbackMessage: t("utilities.timer.alertPlaybackFailed", {
        minute: rule.minuteMark,
        error: "",
      }),
    });
  };

  const handleAddAlertMinute = async () => {
    const parsedMinute = Number.parseInt(newAlertMinute, 10);
    if (!Number.isFinite(parsedMinute) || parsedMinute <= 0) {
      notify.error(t("utilities.timer.invalidAlertMinute"));
      return;
    }

    if (alertRules.some((rule) => rule.minuteMark === parsedMinute)) {
      notify.error(t("utilities.timer.duplicateAlertMinute"));
      return;
    }

    await updateAlertRules((rules) => [...rules, { minuteMark: parsedMinute, audioPath: null }]);
    setNewAlertMinute("2");
  };

  const handleRemoveAlertMinute = async (minuteMark: number) => {
    if (isMandatoryAlertMinute(minuteMark)) {
      return;
    }
    await updateAlertRules((rules) => rules.filter((rule) => rule.minuteMark !== minuteMark));
  };

  const handleAlertVolumeChange = (value: number[]) => {
    if (value[0] == null) {
      return;
    }

    setAlertVolume(normalizeAlertVolume(value[0] / 100));
  };

  const handleAlertVolumeCommit = (value: number[]) => {
    if (value[0] == null) {
      return;
    }

    const nextVolume = normalizeAlertVolume(value[0] / 100);
    setAlertVolume(nextVolume);
    void persistAlertVolume(nextVolume);
  };

  const displayMode = isRunning ? (timerState?.mode ?? mode) : mode;
  const displayTimeMs = displayMode === "countdown" && !isRunning
    ? countdownValueMs
    : currentTimeMs;
  const projectionContextTitle = displayMode === "countdown"
    ? t("utilities.projection.context.countdown")
    : t("utilities.projection.context.stopwatch");
  const projectionCountdownLabel = t("utilities.timer.countdown");
  const projectionStopwatchLabel = t("utilities.timer.stopwatch");

  const projectTimer = useCallback(async () => {
    const projectedTimeMs = normalizeProjectedTimerValue(displayMode, displayTimeMs);
    await startProjection(
      createUtilityProjectionPayload({
        kind: "timer",
        displayValue: formatUtilityTimer(projectedTimeMs, displayMode),
        subtitle: displayMode === "countdown" ? projectionCountdownLabel : projectionStopwatchLabel,
        contextTitle: projectionContextTitle,
      }),
    );
  }, [
    displayMode,
    displayTimeMs,
    projectionContextTitle,
    projectionCountdownLabel,
    projectionStopwatchLabel,
    startProjection,
  ]);

  const startTimerProjectionFlow = useCallback(async () => {
    const projectedTimeMs = normalizeProjectedTimerValue(displayMode, displayTimeMs);
    const [, error] = await catcher(
      (async () => {
        await projectTimer();
        if (displayMode === "countdown") {
          await startCountdownProjection(
            projectionContextTitle,
            projectionCountdownLabel,
            projectedTimeMs,
          );
        } else {
          await startStopwatchProjection(
            projectionContextTitle,
            projectionStopwatchLabel,
            projectedTimeMs,
          );
        }
      })(),
      { notify: true },
    );

    if (error) {
      await stopUtilityProjection().catch(() => {});
      await stopProjection().catch(() => {});
    }
  }, [
    displayMode,
    displayTimeMs,
    projectTimer,
    projectionContextTitle,
    projectionCountdownLabel,
    projectionStopwatchLabel,
    stopProjection,
  ]);

  const stopTimerProjectionFlow = useCallback(async () => {
    await catcher(
      (async () => {
        await stopUtilityProjection();
        await stopProjection();
      })(),
      { notify: true },
    );
  }, [stopProjection]);

  useEffect(() => {
    return () => {
      void stopUtilityProjection();
    };
  }, []);

  useEffect(() => {
    if (!isProjecting) {
      void stopUtilityProjection();
    }
  }, [isProjecting]);

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
              onClick={() => setMode("countdown")}
              label={t("utilities.timer.countdown")}
            />
            <ModeButton
              active={mode === "stopwatch"}
              onClick={() => setMode("stopwatch")}
              label={t("utilities.timer.stopwatch")}
            />
          </div>

          {mode === "countdown" && (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="grid grid-cols-2 gap-3 md:max-w-sm">
                <Input
                  type="number"
                  min={0}
                  value={countdownMinutesValue}
                  label={t("utilities.timer.minutes")}
                  onChange={(e) => handleMinutesInputChange(e.target.value)}
                  disabled={isRunning && timerState?.mode === "countdown"}
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={countdownSecondsValue}
                  label={t("utilities.timer.seconds")}
                  onChange={(e) => handleSecondsInputChange(e.target.value)}
                  disabled={isRunning && timerState?.mode === "countdown"}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("utilities.timer.adjustTitle")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {COUNTDOWN_QUICK_ADJUSTMENTS_MINUTES.map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAdjustCountdownMinutes(value)}
                      disabled={adjustCountdownTimer.isPending}
                    >
                      {value > 0 ? `+${value}` : String(value)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
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
            <Button
              size="sm"
              onClick={handleStart}
              disabled={startTimer.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              {t("utilities.timer.start")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePause}
              disabled={!isRunning || pauseTimer.isPending}
            >
              <Pause className="mr-2 h-4 w-4" />
              {t("utilities.timer.pause")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResume}
              disabled={isRunning || !hasProgress || resumeTimer.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              {t("utilities.timer.resume")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={resetTimer.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("utilities.timer.reset")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLap}
              disabled={!isRunning || displayMode !== "stopwatch" || addLap.isPending}
            >
              <TimerReset className="mr-2 h-4 w-4" />
              {t("utilities.timer.lap")}
            </Button>
            <Button
              size="sm"
              variant={isProjecting ? "destructive" : "outline"}
              onClick={() => {
                if (isProjecting) {
                  void stopTimerProjectionFlow();
                  return;
                }
                void startTimerProjectionFlow();
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

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>{t("utilities.timer.alertsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("utilities.timer.alertsDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("utilities.timer.alertVolume")}</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(alertVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[Math.round(alertVolume * 100)]}
                min={0}
                max={100}
                step={1}
                onValueChange={handleAlertVolumeChange}
                onValueCommit={handleAlertVolumeCommit}
              />
              <p className="text-xs text-muted-foreground">{t("utilities.timer.alertVolumeDescription")}</p>
            </div>

            {alertRules.map((rule) => (
              <div
                key={rule.minuteMark}
                className="space-y-2 rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t("utilities.timer.alertAtMinute", { minute: rule.minuteMark })}
                  </p>
                  {!isMandatoryAlertMinute(rule.minuteMark) && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveAlertMinute(rule.minuteMark)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("utilities.timer.removeAlert")}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    readOnly
                    value={rule.audioPath ?? t("utilities.timer.defaultBeep")}
                    className="min-w-[220px] flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBrowseAlertAudio(rule.minuteMark)}
                  >
                    {t("utilities.timer.browseAudio")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleTestAlert(rule)}
                  >
                    {t("utilities.timer.testAudio")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleClearAlertAudio(rule.minuteMark)}
                    disabled={!rule.audioPath}
                  >
                    {t("utilities.timer.clearAudio")}
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-end gap-2">
              <Input
                type="number"
                min={1}
                value={newAlertMinute}
                label={t("utilities.timer.addAlertMinute")}
                onChange={(event) => setNewAlertMinute(event.target.value)}
                className="w-40"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleAddAlertMinute()}
              >
                {t("utilities.timer.addAlert")}
              </Button>
            </div>
          </CardContent>
        </Card>
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

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

function normalizeProjectedTimerValue(mode: TimerMode, valueMs: number): number {
  const safeValueMs = Math.max(0, Math.floor(valueMs));
  if (mode === "countdown") {
    return Math.floor(safeValueMs / 1000) * 1000;
  }
  return safeValueMs;
}
