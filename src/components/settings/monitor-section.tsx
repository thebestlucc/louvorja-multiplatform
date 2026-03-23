import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { Monitor } from "lucide-react";
import { useMonitorConfigs, useMonitors, useIdentifyMonitors, useSaveMonitorConfig } from "../../lib/queries";
import type { MonitorConfig } from "../../lib/bindings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { closeProjectorWindow, closeReturnWindow, openProjectorWindow, openReturnWindow } from "../../lib/tauri";
import { resolveProjectionMonitorIndexes } from "../../lib/monitor-resolution";
import { getPreferredMonitorName } from "../../lib/monitor-display-name";

export function MonitorSection() {
  const { t } = useTranslation();

  const { data: monitors = [] } = useMonitors();
  const { data: monitorConfigs = [] } = useMonitorConfigs();
  const saveMonitorConfigMutation = useSaveMonitorConfig();
  const identifyMonitorsMutation = useIdentifyMonitors();

  const [projectorMonitorId, setProjectorMonitorId] = useState("");
  const [returnMonitorId, setReturnMonitorId] = useState("");
  const [monitorFeedback, setMonitorFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testingMonitorRole, setTestingMonitorRole] = useState<"projector" | "return" | null>(null);

  const monitorOptions = useMemo(
    () =>
      monitors.map((monitor, index) => ({
        id: monitor.id,
        name: getPreferredMonitorName(monitor, index),
        resolution: `${monitor.width}x${monitor.height}`,
        isPrimary: monitor.isPrimary,
        connectionType: monitor.connectionType ?? "unknown",
      })),
    [monitors],
  );

  const getConnectionTypeLabel = (connectionType: "integrated" | "external" | "unknown") => {
    switch (connectionType) {
      case "integrated":
        return t("settings.monitorConnectionIntegrated");
      case "external":
        return t("settings.monitorConnectionExternal");
      default:
        return t("settings.monitorConnectionUnknown");
    }
  };

  useEffect(() => {
    if (monitorOptions.length === 0) {
      setProjectorMonitorId("");
      setReturnMonitorId("");
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

    setProjectorMonitorId(existingProjectorValid ?? fallbackProjector);
    setReturnMonitorId(existingReturnValid ?? fallbackReturn);
  }, [monitorConfigs, monitorOptions, monitors]);

  const monitorSelectionConfigs = useMemo<MonitorConfig[]>(() => {
    const configs: MonitorConfig[] = [];
    if (projectorMonitorId) {
      configs.push({ id: 0, monitorId: projectorMonitorId, role: "projector", enabled: true });
    }
    if (returnMonitorId) {
      configs.push({ id: 0, monitorId: returnMonitorId, role: "return", enabled: true });
    }
    return configs;
  }, [projectorMonitorId, returnMonitorId]);

  const resolvedMonitorIndexes = useMemo(
    () => resolveProjectionMonitorIndexes(monitors, monitorSelectionConfigs),
    [monitorSelectionConfigs, monitors],
  );
  const projectorMonitorIndex = resolvedMonitorIndexes?.projectorIndex;
  const returnMonitorIndex = resolvedMonitorIndexes?.returnIndex;
  const projectorResolvedMonitorId = projectorMonitorIndex != null ? monitors[projectorMonitorIndex]?.id : undefined;
  const returnResolvedMonitorId = returnMonitorIndex != null ? monitors[returnMonitorIndex]?.id : undefined;
  const hasMonitorOptions = monitorOptions.length > 0;
  const hasMonitorSelectionConflict = monitorOptions.length > 1
    && projectorMonitorId.length > 0
    && returnMonitorId.length > 0
    && projectorMonitorId === returnMonitorId;
  const canSaveMonitorAssignments = hasMonitorOptions
    && projectorMonitorId.length > 0
    && returnMonitorId.length > 0
    && !hasMonitorSelectionConflict
    && !saveMonitorConfigMutation.isPending;

  const handleSaveMonitorAssignments = async () => {
    if (hasMonitorSelectionConflict) {
      const message = t("settings.monitorAssignmentDistinctRequired");
      setMonitorFeedback({ type: "error", message });
      notify.error(message);
      return;
    }
    if (!canSaveMonitorAssignments) return;
    setMonitorFeedback(null);

    const [_, error] = await catcher(async () => {
      await saveMonitorConfigMutation.mutateAsync({ monitorId: projectorMonitorId, role: "projector" });
      await saveMonitorConfigMutation.mutateAsync({ monitorId: returnMonitorId, role: "return" });
    }, { notify: false });

    if (error) {
      const message = t("settings.monitorAssignmentSaveFailed", { error: error.message });
      setMonitorFeedback({ type: "error", message });
      notify.error(message);
    } else {
      const successMessage = t("settings.monitorAssignmentSaved");
      setMonitorFeedback({ type: "success", message: successMessage });
      notify.success(successMessage);
    }
  };

  const openMonitorWindowTemporarily = async (role: "projector" | "return") => {
    const monitorId = role === "projector" ? projectorResolvedMonitorId : returnResolvedMonitorId;
    if (!monitorId) return;
    setTestingMonitorRole(role);

    const [_, error] = await catcher(async () => {
      if (role === "projector") {
        await openProjectorWindow(monitorId);
        window.setTimeout(() => { void closeProjectorWindow(); }, 2500);
      } else {
        await openReturnWindow(monitorId);
        window.setTimeout(() => { void closeReturnWindow(); }, 2500);
      }
      window.setTimeout(() => {
        setTestingMonitorRole((currentRole) => currentRole === role ? null : currentRole);
      }, 2600);
    }, { notify: false });

    if (error) {
      setTestingMonitorRole((currentRole) => currentRole === role ? null : currentRole);
      notify.error(t("settings.monitorAssignmentTestFailed", { error: error.message }));
    }
  };

  const handleIdentifyMonitors = async () => {
    await catcher(identifyMonitorsMutation.mutateAsync(), { notify: true });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">{t("settings.monitorAssignmentTitle")}</h2>
      </div>

      <div className="space-y-5">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">{t("settings.monitorAssignmentTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("settings.monitorAssignmentDesc")}</p>
            </div>

            {hasMonitorOptions ? (
              <>
                <div className="space-y-2">
                  {monitorOptions.map((option) => (
                    <div key={option.id} className="rounded-md border border-border/70 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{option.name}</span>
                        <span className="text-xs text-muted-foreground">{option.resolution}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {option.isPrimary ? (
                          <span className="inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {t("settings.monitorAssignmentPrimary")}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                            option.connectionType === "integrated"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : option.connectionType === "external"
                              ? "bg-sky-500/15 text-sky-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {getConnectionTypeLabel(option.connectionType as any)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">{t("settings.monitorAssignmentProjector")}</span>
                    <Select
                      value={projectorMonitorId}
                      onValueChange={(value) => {
                        setProjectorMonitorId(value);
                        setMonitorFeedback(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monitorOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} ({option.resolution}) • {getConnectionTypeLabel(option.connectionType as any)}
                            {option.isPrimary ? ` • ${t("settings.monitorAssignmentPrimary")}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">{t("settings.monitorAssignmentReturn")}</span>
                    <Select
                      value={returnMonitorId}
                      onValueChange={(value) => {
                        setReturnMonitorId(value);
                        setMonitorFeedback(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monitorOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name} ({option.resolution}) • {getConnectionTypeLabel(option.connectionType as any)}
                            {option.isPrimary ? ` • ${t("settings.monitorAssignmentPrimary")}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleIdentifyMonitors()}
                    disabled={identifyMonitorsMutation.isPending}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    {t("display.identifyMonitors")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openMonitorWindowTemporarily("projector")}
                    disabled={projectorResolvedMonitorId == null || testingMonitorRole !== null}
                  >
                    {testingMonitorRole === "projector"
                      ? t("settings.monitorAssignmentTesting")
                      : t("settings.monitorAssignmentTestProjector")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openMonitorWindowTemporarily("return")}
                    disabled={returnResolvedMonitorId == null || hasMonitorSelectionConflict || testingMonitorRole !== null}
                  >
                    {testingMonitorRole === "return"
                      ? t("settings.monitorAssignmentTesting")
                      : t("settings.monitorAssignmentTestReturn")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveMonitorAssignments()}
                    disabled={!canSaveMonitorAssignments}
                  >
                    {saveMonitorConfigMutation.isPending
                      ? t("settings.monitorAssignmentSaving")
                      : t("settings.monitorAssignmentSave")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("settings.monitorAssignmentNone")}</p>
            )}

            {monitorFeedback ? (
              <p
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  monitorFeedback.type === "success"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-destructive/40 bg-destructive/10 text-destructive-foreground",
                )}
              >
                {monitorFeedback.message}
              </p>
            ) : null}

            {hasMonitorSelectionConflict ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                {t("settings.monitorAssignmentDistinctRequired")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
