import { audioPlayAlert } from "./tauri";
import type { Setting } from "./bindings";
import { catcherSync } from "./catcher";

export interface TimerAlertRule {
  minuteMark: number;
  audioPath: string | null;
}

export const TIMER_ALERTS_SETTING_KEY = "timer.alertRules";
export const TIMER_ALERT_VOLUME_SETTING_KEY = "timer.alertVolume";
export const MANDATORY_ALERT_MINUTES = [5, 1] as const;
export const DEFAULT_TIMER_ALERT_VOLUME = 1;

export function normalizeAlertRules(rules: TimerAlertRule[]): TimerAlertRule[] {
  const deduplicated = new Map<number, string | null>();

  for (const rule of rules) {
    const minuteMark = Math.floor(rule.minuteMark);
    if (!Number.isFinite(minuteMark) || minuteMark <= 0) {
      continue;
    }
    deduplicated.set(minuteMark, normalizeAudioPath(rule.audioPath));
  }

  for (const minuteMark of MANDATORY_ALERT_MINUTES) {
    if (!deduplicated.has(minuteMark)) {
      deduplicated.set(minuteMark, null);
    }
  }

  return Array.from(deduplicated.entries())
    .map(([minuteMark, audioPath]) => ({ minuteMark, audioPath }))
    .sort((left, right) => right.minuteMark - left.minuteMark);
}

export function parseAlertRulesSetting(settings: Setting[] | null | undefined): TimerAlertRule[] {
  const value = settings?.find((s) => s.key === TIMER_ALERTS_SETTING_KEY)?.value;
  if (!value) {
    return normalizeAlertRules([]);
  }

  const [parsed, error] = catcherSync(() => JSON.parse(value), { notify: false });

  if (error || !Array.isArray(parsed)) {
    return normalizeAlertRules([]);
  }

  const rules = parsed
    .map((item): TimerAlertRule | null => {
      if (typeof item !== "object" || item == null) {
        return null;
      }

      const rawMinuteMark = (item as { minuteMark?: unknown }).minuteMark;
      const rawAudioPath = (item as { audioPath?: unknown }).audioPath;
      if (typeof rawMinuteMark !== "number") {
        return null;
      }

      return {
        minuteMark: rawMinuteMark,
        audioPath: typeof rawAudioPath === "string" ? rawAudioPath : null,
      };
    })
    .filter((rule): rule is TimerAlertRule => rule != null);

  return normalizeAlertRules(rules);
}

export function isMandatoryAlertMinute(minuteMark: number): boolean {
  return MANDATORY_ALERT_MINUTES.includes(minuteMark as (typeof MANDATORY_ALERT_MINUTES)[number]);
}

export function normalizeAlertVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TIMER_ALERT_VOLUME;
  }
  return Math.max(0, Math.min(1, value));
}

export function parseAlertVolumeSetting(settings: Setting[] | null | undefined): number {
  const value = settings?.find((s) => s.key === TIMER_ALERT_VOLUME_SETTING_KEY)?.value;
  if (typeof value !== "string") {
    return DEFAULT_TIMER_ALERT_VOLUME;
  }

  const parsed = Number.parseFloat(value);
  return normalizeAlertVolume(parsed);
}

export async function playTimerAlertRule(rule: TimerAlertRule, volume: number): Promise<void> {
  await audioPlayAlert(rule.audioPath, normalizeAlertVolume(volume));
}

function normalizeAudioPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
