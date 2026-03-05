import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MonitorCheck, MonitorPlay, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  closeProjectorWindow,
  closeReturnWindow,
  openProjectorWindow,
  openReturnWindow,
} from "../../lib/tauri";
import { resolveProjectionMonitorIndexes } from "../../lib/monitor-resolution";
import { useMonitorConfigs, useMonitors, useSaveMonitorConfig } from "../../lib/queries";
import { getPreferredMonitorName } from "../../lib/monitor-display-name";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const Route = createFileRoute("/onboarding/monitors")({
  component: OnboardingMonitorsPage,
});

function OnboardingMonitorsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: monitors = [] } = useMonitors();
  const { data: monitorConfigs = [] } = useMonitorConfigs();
  const saveConfig = useSaveMonitorConfig();
  const [projectorId, setProjectorId] = useState("");
  const [returnId, setReturnId] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const monitorOptions = useMemo(
    () =>
      monitors.map((monitor, index) => ({
        id: monitor.id,
        label:
          `${getPreferredMonitorName(monitor, index)} (${monitor.width}x${monitor.height})${monitor.isPrimary ? ` • ${t("onboarding.monitors.primary")}` : ""}`,
      })),
    [monitors, t],
  );

  const hasMonitorSelectionConflict = monitorOptions.length > 1
    && projectorId.length > 0
    && returnId.length > 0
    && projectorId === returnId;

  useEffect(() => {
    if (!monitorOptions.length) {
      setProjectorId("");
      setReturnId("");
      return;
    }

    const existingProjector = monitorConfigs.find((config) => config.role === "projector")?.monitorId;
    const existingReturn = monitorConfigs.find((config) => config.role === "return")?.monitorId;
    const existingProjectorValid = existingProjector && monitorOptions.some((option) => option.id === existingProjector)
      ? existingProjector
      : undefined;
    const existingReturnValid = existingReturn && monitorOptions.some((option) => option.id === existingReturn)
      ? existingReturn
      : undefined;
    const fallbackIndexes = resolveProjectionMonitorIndexes(monitors, []);
    const fallbackProjector = fallbackIndexes
      ? (monitors[fallbackIndexes.projectorIndex]?.id ?? monitorOptions[0]?.id ?? "")
      : (monitorOptions[0]?.id ?? "");
    const fallbackReturn = fallbackIndexes
      ? (monitors[fallbackIndexes.returnIndex]?.id
        ?? monitorOptions.find((option) => option.id !== fallbackProjector)?.id
        ?? fallbackProjector)
      : (monitorOptions.find((option) => option.id !== fallbackProjector)?.id ?? fallbackProjector);
    setProjectorId(existingProjectorValid ?? fallbackProjector);
    setReturnId(existingReturnValid ?? fallbackReturn);
  }, [monitorConfigs, monitorOptions, monitors]);

  const handleSaveAndContinue = async () => {
    if (hasMonitorSelectionConflict) {
      setFeedback(t("onboarding.monitors.distinctRequired"));
      return;
    }

    setFeedback(null);
    setSaving(true);
    try {
      if (projectorId) {
        await saveConfig.mutateAsync({ monitorId: projectorId, role: "projector" });
      }
      if (returnId) {
        await saveConfig.mutateAsync({ monitorId: returnId, role: "return" });
      }
      navigate({ to: "/onboarding/complete" });
    } catch (error) {
      setFeedback(String(error));
    } finally {
      setSaving(false);
    }
  };

  const openWindowTemporarily = async (type: "projector" | "return") => {
    const monitorId = type === "projector" ? projectorId : returnId;
    if (!monitorId) {
      return;
    }

    if (type === "projector") {
      await openProjectorWindow(monitorId);
      window.setTimeout(() => {
        void closeProjectorWindow();
      }, 2500);
      return;
    }

    await openReturnWindow(monitorId);
    window.setTimeout(() => {
      void closeReturnWindow();
    }, 2500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorCheck className="h-4 w-4 text-primary" />
          {t("onboarding.monitors.title")}
        </CardTitle>
        <CardDescription>{t("onboarding.monitors.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {monitorOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("onboarding.monitors.noneFound")}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("onboarding.monitors.projector")}</span>
              <select
                value={projectorId}
                onChange={(event) => {
                  setProjectorId(event.target.value);
                  setFeedback(null);
                }}
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
              >
                {monitorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("onboarding.monitors.return")}</span>
              <select
                value={returnId}
                onChange={(event) => {
                  setReturnId(event.target.value);
                  setFeedback(null);
                }}
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
              >
                {monitorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void openWindowTemporarily("projector")}
            disabled={projectorId.length === 0}
          >
            <MonitorPlay className="mr-2 h-4 w-4" />
            {t("onboarding.monitors.testProjector")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void openWindowTemporarily("return")}
            disabled={returnId.length === 0 || hasMonitorSelectionConflict}
          >
            <MonitorPlay className="mr-2 h-4 w-4" />
            {t("onboarding.monitors.testReturn")}
          </Button>
        </div>

        {hasMonitorSelectionConflict ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
            {t("onboarding.monitors.distinctRequired")}
          </p>
        ) : null}

        {feedback ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {feedback}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleSaveAndContinue()}
            disabled={saving || hasMonitorSelectionConflict}
          >
            {t("onboarding.monitors.saveAndContinue")}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/onboarding/complete" })}>
            <SkipForward className="mr-2 h-4 w-4" />
            {t("onboarding.monitors.skip")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
