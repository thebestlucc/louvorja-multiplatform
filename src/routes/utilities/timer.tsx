import { useCallback, useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
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
import { TimerLayout, parseNonNegativeInteger, normalizeProjectedTimerValue } from "./_timer-layout";

export const Route = createFileRoute("/utilities/timer")({
  component: UtilitiesTimerPage,
});

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

  const updateAlertRules = async (updater: (rules: TimerAlertRule[]) => TimerAlertRule[]) => {
    const nextRules = normalizeAlertRules(updater(alertRules));
    setAlertRules(nextRules);
    await catcher(
      setSettingMutation.mutateAsync({ key: TIMER_ALERTS_SETTING_KEY, value: JSON.stringify(nextRules) }),
      { notify: true },
    );
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
    persistAlertVolume(nextVolume);
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
      stopUtilityProjection();
    };
  }, []);

  useEffect(() => {
    if (!isProjecting) {
      stopUtilityProjection();
    }
  }, [isProjecting]);

  const isCountdownRuntime = timerState?.mode === "countdown" && timerState.durationMs != null;

  return (
    <TimerLayout
      mode={mode}
      onModeChange={setMode}
      displayMode={displayMode}
      displayTimeMs={displayTimeMs}
      countdownMinutesValue={countdownMinutesValue}
      countdownSecondsValue={countdownSecondsValue}
      isCountdownRuntime={isCountdownRuntime}
      isAdjustPending={adjustCountdownTimer.isPending}
      onMinutesChange={handleMinutesInputChange}
      onSecondsChange={handleSecondsInputChange}
      onAdjustMinutes={handleAdjustCountdownMinutes}
      isRunning={isRunning}
      hasProgress={hasProgress}
      laps={laps}
      isStartPending={startTimer.isPending}
      isPausePending={pauseTimer.isPending}
      isResumePending={resumeTimer.isPending}
      isResetPending={resetTimer.isPending}
      isLapPending={addLap.isPending}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onReset={handleReset}
      onLap={handleLap}
      isProjecting={isProjecting}
      onStartProjection={startTimerProjectionFlow}
      onStopProjection={stopTimerProjectionFlow}
      alertRules={alertRules}
      alertVolume={alertVolume}
      newAlertMinute={newAlertMinute}
      onAlertVolumeChange={handleAlertVolumeChange}
      onAlertVolumeCommit={handleAlertVolumeCommit}
      onBrowseAlertAudio={handleBrowseAlertAudio}
      onClearAlertAudio={handleClearAlertAudio}
      onTestAlert={handleTestAlert}
      onAddAlertMinute={handleAddAlertMinute}
      onRemoveAlertMinute={handleRemoveAlertMinute}
      onNewAlertMinuteChange={setNewAlertMinute}
    />
  );
}
