import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { useUtilityProjection } from "../../hooks/use-utility-projection";
import { createUtilityProjectionPayload } from "../../types/utilities";
import {
  startClockProjection,
  stopUtilityProjection,
} from "../../lib/tauri";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ClockDisplay } from "../../components/utilities/clock-display";

export const Route = createFileRoute("/utilities/clock")({
  component: UtilitiesClockPage,
});

function UtilitiesClockPage() {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const [use24Hour, setUse24Hour] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const { isProjecting, startProjection, stopProjection } = useUtilityProjection("clock");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const displayTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !use24Hour,
  });

  const displayDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const projectClock = useCallback(async () => {
    await startProjection(
      createUtilityProjectionPayload({
        kind: "clock",
        displayValue: displayTime,
        subtitle: showDate ? displayDate : undefined,
        contextTitle: t("utilities.projection.context.clock"),
      }),
    );
  }, [displayDate, displayTime, showDate, startProjection, t]);

  const startClockProjectionFlow = useCallback(async () => {
    try {
      await projectClock();
      await startClockProjection(
        t("utilities.projection.context.clock"),
        t("utilities.clock.title"),
        use24Hour,
        showDate,
      );
    } catch (error) {
      await stopUtilityProjection().catch(() => {});
      await stopProjection().catch(() => {});
      notify.tauriError(error);
    }
  }, [projectClock, showDate, stopProjection, t, use24Hour]);

  const stopClockProjectionFlow = useCallback(async () => {
    await stopUtilityProjection().catch(() => {});
    await stopProjection().catch(() => {});
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
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle>{t("utilities.clock.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("utilities.clock.description")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={use24Hour ? "default" : "outline"}
            onClick={() => setUse24Hour(true)}
          >
            {t("utilities.clock.hour24")}
          </Button>
          <Button
            size="sm"
            variant={!use24Hour ? "default" : "outline"}
            onClick={() => setUse24Hour(false)}
          >
            {t("utilities.clock.hour12")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDate((value) => !value)}
          >
            {showDate ? t("utilities.clock.hideDate") : t("utilities.clock.showDate")}
          </Button>
          <Button
            size="sm"
            variant={isProjecting ? "destructive" : "outline"}
            onClick={() => {
              if (isProjecting) {
                void stopClockProjectionFlow();
                return;
              }
              void startClockProjectionFlow();
            }}
          >
            {isProjecting ? t("utilities.projection.clear") : t("utilities.projection.project")}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border border-border bg-background px-4 py-10 text-center">
          <ClockDisplay date={now} use24Hour={use24Hour} showDate={showDate} size="large" />
        </div>
      </CardContent>
    </Card>
  );
}
