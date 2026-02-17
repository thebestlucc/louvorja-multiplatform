import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAllSettings, useTimerState } from "../lib/queries";
import {
  parseAlertVolumeSetting,
  parseAlertRulesSetting,
  playTimerAlertRule,
  TIMER_ALERT_VOLUME_SETTING_KEY,
  TIMER_ALERTS_SETTING_KEY,
} from "../lib/timer-alerts";

interface UseTimerAlertsOptions {
  enabled?: boolean;
}

export function useTimerAlerts(options: UseTimerAlertsOptions = {}) {
  const { enabled = true } = options;
  const { t } = useTranslation();
  const { data: timerState } = useTimerState({ enabled });
  const { data: allSettings } = useAllSettings({ enabled });

  const alertRules = useMemo(() => {
    const alertSettingValue = allSettings?.find((setting) => setting.key === TIMER_ALERTS_SETTING_KEY)?.value ?? null;
    return parseAlertRulesSetting(alertSettingValue);
  }, [allSettings]);
  const alertVolume = useMemo(() => {
    const alertVolumeSettingValue = allSettings?.find((setting) => setting.key === TIMER_ALERT_VOLUME_SETTING_KEY)?.value;
    return parseAlertVolumeSetting(alertVolumeSettingValue);
  }, [allSettings]);

  const triggeredAlertMinutesRef = useRef<Set<number>>(new Set());
  const previousRemainingMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      previousRemainingMsRef.current = null;
      triggeredAlertMinutesRef.current.clear();
      return;
    }

    if (!timerState || timerState.mode !== "countdown") {
      previousRemainingMsRef.current = null;
      triggeredAlertMinutesRef.current.clear();
      return;
    }

    const currentRemainingMs = timerState.currentTimeMs;
    const previousRemainingMs = previousRemainingMsRef.current;

    if (previousRemainingMs != null) {
      const currentRemainingSeconds = Math.floor(currentRemainingMs / 1000);
      const previousRemainingSeconds = Math.floor(previousRemainingMs / 1000);
      if (currentRemainingSeconds > previousRemainingSeconds) {
        for (const rule of alertRules) {
          const thresholdSeconds = rule.minuteMark * 60;
          if (currentRemainingSeconds > thresholdSeconds) {
            triggeredAlertMinutesRef.current.delete(rule.minuteMark);
          }
        }
      }
    }

    if (!timerState.isRunning) {
      previousRemainingMsRef.current = currentRemainingMs;
      return;
    }

    const currentRemainingSeconds = Math.floor(currentRemainingMs / 1000);
    const previousRemainingSeconds = previousRemainingMs == null
      ? currentRemainingSeconds + 1
      : Math.floor(previousRemainingMs / 1000);

    for (const rule of alertRules) {
      const thresholdSeconds = rule.minuteMark * 60;
      if (triggeredAlertMinutesRef.current.has(rule.minuteMark)) {
        continue;
      }

      if (previousRemainingSeconds > thresholdSeconds && currentRemainingSeconds <= thresholdSeconds) {
        triggeredAlertMinutesRef.current.add(rule.minuteMark);
        void playTimerAlertRule(rule, alertVolume).catch((error) => {
          toast.error(
            t("utilities.timer.alertPlaybackFailed", {
              minute: rule.minuteMark,
              error: String(error),
            }),
          );
        });
      }
    }

    previousRemainingMsRef.current = currentRemainingMs;
  }, [alertRules, alertVolume, enabled, t, timerState]);
}
