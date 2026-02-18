import type { MonitorConfig, MonitorInfo } from "../types/settings";

type ProjectionMonitorRole = "projector" | "return";

type ProjectionMonitorIndexes = {
  projectorIndex: number;
  returnIndex: number;
};

type ProjectionMonitorAssignments = {
  projectorMonitorId: string;
  returnMonitorId: string;
};

export function resolveProjectionMonitorIndexes(
  monitors: MonitorInfo[],
  configs: MonitorConfig[],
): ProjectionMonitorIndexes | null {
  if (monitors.length === 0) {
    return null;
  }

  const monitorIndexById = new Map(monitors.map((monitor, index) => [monitor.id, index] as const));
  const projectorFallbackIndex = resolveDefaultProjectorFallbackIndex(monitors);
  const returnFallbackIndex = resolveDefaultReturnFallbackIndex(monitors, projectorFallbackIndex);
  const projectorIndex = resolveMonitorIndex(
    "projector",
    configs,
    monitorIndexById,
    monitors.length,
    projectorFallbackIndex,
  );
  let returnIndex = resolveMonitorIndex(
    "return",
    configs,
    monitorIndexById,
    monitors.length,
    returnFallbackIndex,
  );

  // Avoid assigning both roles to the same monitor if we have alternatives.
  if (monitors.length > 1 && projectorIndex === returnIndex) {
    returnIndex = projectorIndex === 0 ? 1 : 0;
  }

  return { projectorIndex, returnIndex };
}

export function resolveAutomaticProjectionAssignments(
  monitors: MonitorInfo[],
  configs: MonitorConfig[],
  previousMonitorIds: string[],
  previousPrimaryMonitorId: string | null,
): ProjectionMonitorAssignments | null {
  if (monitors.length === 0) {
    return null;
  }

  const addedMonitors = monitors.filter((monitor) => !previousMonitorIds.includes(monitor.id));
  const currentPrimaryMonitorId = monitors.find((monitor) => monitor.is_primary)?.id ?? null;
  const primaryMonitorChanged = currentPrimaryMonitorId !== previousPrimaryMonitorId;
  if (addedMonitors.length === 0 && !primaryMonitorChanged) {
    return null;
  }

  const addedMonitorCandidate = addedMonitors.find((monitor) => !monitor.is_primary) ?? addedMonitors[0];
  const fallbackIndexes = resolveProjectionMonitorIndexes(monitors, []);
  const fallbackProjectorMonitorId = fallbackIndexes
    ? (monitors[fallbackIndexes.projectorIndex]?.id ?? monitors[0]?.id)
    : monitors[0]?.id;
  const projectorMonitorId = addedMonitorCandidate?.id ?? fallbackProjectorMonitorId;
  if (!projectorMonitorId) {
    return null;
  }

  const existingReturnConfig = configs.find((config) => config.role === "return" && config.enabled);
  const resolverConfigs: MonitorConfig[] = [
    {
      id: 0,
      monitor_id: projectorMonitorId,
      role: "projector",
      enabled: true,
    },
  ];
  if (existingReturnConfig?.monitor_id) {
    resolverConfigs.push({
      id: 0,
      monitor_id: existingReturnConfig.monitor_id,
      role: "return",
      enabled: true,
    });
  }
  const resolvedIndexes = resolveProjectionMonitorIndexes(monitors, resolverConfigs);
  const fallbackReturnMonitorId = monitors.find((monitor) => monitor.id !== projectorMonitorId)?.id ?? projectorMonitorId;
  const returnMonitorId = resolvedIndexes
    ? (monitors[resolvedIndexes.returnIndex]?.id ?? fallbackReturnMonitorId)
    : fallbackReturnMonitorId;

  const currentProjectorMonitorId = configs.find((config) => config.role === "projector" && config.enabled)?.monitor_id;
  const currentReturnMonitorId = configs.find((config) => config.role === "return" && config.enabled)?.monitor_id;
  if (currentProjectorMonitorId === projectorMonitorId && currentReturnMonitorId === returnMonitorId) {
    return null;
  }

  return { projectorMonitorId, returnMonitorId };
}

function resolveMonitorIndex(
  role: ProjectionMonitorRole,
  configs: MonitorConfig[],
  monitorIndexById: Map<string, number>,
  monitorCount: number,
  fallbackIndex: number,
): number {
  const configuredMonitorId = configs
    .find((config) => config.role === role && config.enabled)
    ?.monitor_id;
  const configuredIndex = configuredMonitorId != null ? monitorIndexById.get(configuredMonitorId) : undefined;
  if (configuredIndex != null && Number.isFinite(configuredIndex)) {
    return configuredIndex;
  }

  const legacyConfiguredIndex = parseLegacyMonitorIndex(configuredMonitorId);
  if (legacyConfiguredIndex != null && legacyConfiguredIndex >= 0 && legacyConfiguredIndex < monitorCount) {
    return legacyConfiguredIndex;
  }

  return Math.max(0, Math.min(fallbackIndex, monitorCount - 1));
}

function resolveDefaultProjectorFallbackIndex(monitors: MonitorInfo[]): number {
  if (monitors.length === 0) {
    return 0;
  }

  const externalIndex = monitors.findIndex((monitor) => !monitor.is_primary);
  if (externalIndex >= 0) {
    return externalIndex;
  }

  return monitors.length > 1 ? 1 : 0;
}

function resolveDefaultReturnFallbackIndex(monitors: MonitorInfo[], projectorIndex: number): number {
  if (monitors.length === 0) {
    return 0;
  }

  const preferredIndex = monitors.length > 2 ? 2 : 0;
  if (preferredIndex !== projectorIndex && preferredIndex < monitors.length) {
    return preferredIndex;
  }

  const firstDifferentIndex = monitors.findIndex((_, index) => index !== projectorIndex);
  if (firstDifferentIndex >= 0) {
    return firstDifferentIndex;
  }

  return 0;
}

function parseLegacyMonitorIndex(monitorId: string | undefined): number | null {
  if (!monitorId) {
    return null;
  }

  const match = /^monitor-(\d+)$/.exec(monitorId);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
