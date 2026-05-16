import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "../lib/notifications";
import { useAllSettings, useTimerState } from "../lib/queries";
import {
  parseAlertVolumeSetting,
  parseAlertRulesSetting,
  playTimerAlertRule,
} from "../lib/timer-alerts";

export function useTimerAlerts(enabled = true) {
  const { t } = useTranslation();
  const { data: allSettings } = useAllSettings({ enabled });
  const { data: timerState } = useTimerState({ enabled });

  const alertVolume = useMemo(() => parseAlertVolumeSetting(allSettings), [allSettings]);
  const alertRules = useMemo(() => parseAlertRulesSetting(allSettings), [allSettings]);

  const triggeredAlertMinutesRef = useRef<Set<number>>(new Set());
  const previousRemainingMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !timerState || !timerState.isRunning || !timerState.durationMs) {
      if (!timerState?.isRunning) {
        triggeredAlertMinutesRef.current.clear();
        previousRemainingMsRef.current = null;
      }
      return;
    }

    const currentRemainingMs = Math.max(0, timerState.durationMs - timerState.currentTimeMs);
    const previousRemainingMs = previousRemainingMsRef.current;

    if (previousRemainingMs === null) {
      previousRemainingMsRef.current = currentRemainingMs;
      return;
    }

    const currentRemainingSeconds = Math.floor(currentRemainingMs / 1000);
    const previousRemainingSeconds = Math.floor(previousRemainingMs / 1000);

    for (const rule of alertRules) {
      const thresholdSeconds = rule.minuteMark * 60;

      if (triggeredAlertMinutesRef.current.has(rule.minuteMark)) {
        continue;
      }

      if (previousRemainingSeconds > thresholdSeconds && currentRemainingSeconds <= thresholdSeconds) {
        triggeredAlertMinutesRef.current.add(rule.minuteMark);
        playTimerAlertRule(rule, alertVolume).catch((error) => {
          notify.tauriError(
            error,
            t("utilities.timer.alertPlaybackFailed", {
              minute: rule.minuteMark,
              error: "",
            }),
          );
        });
      }
    }

    previousRemainingMsRef.current = currentRemainingMs;
  }, [alertRules, alertVolume, enabled, t, timerState]);
}
