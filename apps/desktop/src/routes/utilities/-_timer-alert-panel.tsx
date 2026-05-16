import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Slider } from "../../components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { isMandatoryAlertMinute, type TimerAlertRule } from "../../lib/timer-alerts";

export interface TimerAlertPanelProps {
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

export function TimerAlertPanel({
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
}: TimerAlertPanelProps) {
  const { t } = useTranslation();

  return (
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
            onValueChange={onAlertVolumeChange}
            onValueCommit={onAlertVolumeCommit}
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
                  onClick={() => onRemoveAlertMinute(rule.minuteMark)}
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
                className="min-w-55 flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBrowseAlertAudio(rule.minuteMark)}
              >
                {t("utilities.timer.browseAudio")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTestAlert(rule)}
              >
                {t("utilities.timer.testAudio")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onClearAlertAudio(rule.minuteMark)}
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
            onChange={(event) => onNewAlertMinuteChange(event.target.value)}
            className="w-40"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAlertMinute()}
          >
            {t("utilities.timer.addAlert")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
