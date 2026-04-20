import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

const COUNTDOWN_QUICK_ADJUSTMENTS_MINUTES = [-10, -5, -1, 1, 5, 10] as const;

export interface TimerConfigPanelProps {
  countdownMinutesValue: string;
  countdownSecondsValue: string;
  isRunning: boolean;
  isCountdownRuntime: boolean;
  isPending: boolean;
  onMinutesChange: (value: string) => void;
  onSecondsChange: (value: string) => void;
  onAdjustMinutes: (delta: number) => void;
}

export function TimerConfigPanel({
  countdownMinutesValue,
  countdownSecondsValue,
  isRunning,
  isCountdownRuntime,
  isPending,
  onMinutesChange,
  onSecondsChange,
  onAdjustMinutes,
}: TimerConfigPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="grid grid-cols-2 gap-3 md:max-w-sm">
        <Input
          type="number"
          min={0}
          value={countdownMinutesValue}
          label={t("utilities.timer.minutes")}
          onChange={(e) => onMinutesChange(e.target.value)}
          disabled={isRunning && isCountdownRuntime}
        />
        <Input
          type="number"
          min={0}
          max={59}
          value={countdownSecondsValue}
          label={t("utilities.timer.seconds")}
          onChange={(e) => onSecondsChange(e.target.value)}
          disabled={isRunning && isCountdownRuntime}
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
              onClick={() => onAdjustMinutes(value)}
              disabled={isPending}
            >
              {value > 0 ? `+${value}` : String(value)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
