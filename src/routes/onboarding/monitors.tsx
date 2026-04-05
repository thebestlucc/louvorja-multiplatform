import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MonitorCheck, MonitorPlay, ArrowLeft, Monitor } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { catcher } from "../../lib/catcher";
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
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monitorOptions = useMemo(
    () =>
      monitors.map((monitor, index) => ({
        id: monitor.id,
        label:
          `${getPreferredMonitorName(monitor, index)} (${monitor.width}x${monitor.height})${monitor.isPrimary ? ` • ${t("onboarding.monitors.primary")}` : ""}`,
      })),
    [monitors, t],
  );

  const isSingleMonitor = monitorOptions.length <= 1;
  const hasMonitorSelectionConflict =
    monitorOptions.length > 1 && projectorId.length > 0 && returnId.length > 0 && projectorId === returnId;

  // Auto-continue after 3s for single monitor
  useEffect(() => {
    if (!isSingleMonitor) return;
    autoTimerRef.current = setTimeout(() => {
      navigate({ to: "/onboarding/ready" });
    }, 3000);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [isSingleMonitor, navigate]);

  // Pre-select monitors from existing config or fallback
  useEffect(() => {
    if (!monitorOptions.length || isSingleMonitor) return;
    const existingProjector = monitorConfigs.find((c) => c.role === "projector")?.monitorId;
    const existingReturn = monitorConfigs.find((c) => c.role === "return")?.monitorId;
    const validProjector =
      existingProjector && monitorOptions.some((o) => o.id === existingProjector) ? existingProjector : undefined;
    const validReturn =
      existingReturn && monitorOptions.some((o) => o.id === existingReturn) ? existingReturn : undefined;
    const fallback = resolveProjectionMonitorIndexes(monitors, []);
    const fbProjector = fallback ? (monitors[fallback.projectorIndex]?.id ?? monitorOptions[0]?.id ?? "") : (monitorOptions[0]?.id ?? "");
    const fbReturn = fallback
      ? (monitors[fallback.returnIndex]?.id ?? monitorOptions.find((o) => o.id !== fbProjector)?.id ?? fbProjector)
      : (monitorOptions.find((o) => o.id !== fbProjector)?.id ?? fbProjector);
    setProjectorId(validProjector ?? fbProjector);
    setReturnId(validReturn ?? fbReturn);
  }, [monitorConfigs, monitorOptions, monitors, isSingleMonitor]);

  const handleSaveAndContinue = async () => {
    if (hasMonitorSelectionConflict) {
      setFeedback(t("onboarding.monitors.distinctRequired"));
      return;
    }
    setFeedback(null);
    setSaving(true);
    const [_, err] = await catcher(async () => {
      if (projectorId) await saveConfig.mutateAsync({ monitorId: projectorId, role: "projector" });
      if (returnId) await saveConfig.mutateAsync({ monitorId: returnId, role: "return" });
    });
    if (err) {
      setFeedback(err.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    navigate({ to: "/onboarding/ready" });
  };

  const openWindowTemporarily = async (type: "projector" | "return") => {
    const monitorId = type === "projector" ? projectorId : returnId;
    if (!monitorId) return;
    if (type === "projector") {
      await openProjectorWindow(monitorId);
      window.setTimeout(() => void closeProjectorWindow(), 2500);
    } else {
      await openReturnWindow(monitorId);
      window.setTimeout(() => void closeReturnWindow(), 2500);
    }
  };

  // Single monitor view
  if (isSingleMonitor) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Monitor className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-foreground">{t("onboarding.monitors.singleTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("onboarding.monitors.singleDescription")}</p>
              <p className="text-xs text-muted-foreground">{t("onboarding.monitors.singleHint")}</p>
            </div>
            <Button
              onClick={() => {
                if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
                navigate({ to: "/onboarding/ready" });
              }}
            >
              {t("onboarding.monitors.continue")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Multi-monitor view
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorCheck className="h-4 w-4 text-primary" />
            {t("onboarding.monitors.title")}
          </CardTitle>
          <CardDescription>{t("onboarding.monitors.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("onboarding.monitors.projector")}</span>
              <p className="text-xs text-muted-foreground">{t("onboarding.monitors.projectorHint")}</p>
              <select
                value={projectorId}
                onChange={(e) => { setProjectorId(e.target.value); setFeedback(null); }}
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
              >
                {monitorOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("onboarding.monitors.return")}</span>
              <p className="text-xs text-muted-foreground">{t("onboarding.monitors.returnHint")}</p>
              <select
                value={returnId}
                onChange={(e) => { setReturnId(e.target.value); setFeedback(null); }}
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
              >
                {monitorOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void openWindowTemporarily("projector")} disabled={!projectorId}>
              <MonitorPlay className="mr-2 h-4 w-4" />
              {t("onboarding.monitors.testProjector")}
            </Button>
            <Button variant="outline" onClick={() => void openWindowTemporarily("return")} disabled={!returnId || hasMonitorSelectionConflict}>
              <MonitorPlay className="mr-2 h-4 w-4" />
              {t("onboarding.monitors.testReturn")}
            </Button>
          </div>

          {hasMonitorSelectionConflict && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              {t("onboarding.monitors.distinctRequired")}
            </p>
          )}
          {feedback && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {feedback}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: "/onboarding/content" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button onClick={() => void handleSaveAndContinue()} disabled={saving || hasMonitorSelectionConflict}>
          {t("onboarding.monitors.saveAndContinue")}
        </Button>
      </div>
    </div>
  );
}
