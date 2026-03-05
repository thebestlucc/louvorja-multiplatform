import type { MonitorConfig, MonitorInfo } from "./bindings";

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
    monitors,
  );
  let returnIndex = resolveMonitorIndex(
    "return",
    configs,
    monitorIndexById,
    monitors.length,
    returnFallbackIndex,
    monitors,
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
  const currentPrimaryMonitorId = monitors.find((monitor) => monitor.isPrimary)?.id ?? null;
  const primaryMonitorChanged = currentPrimaryMonitorId !== previousPrimaryMonitorId;
  if (addedMonitors.length === 0 && !primaryMonitorChanged) {
    return null;
  }

  const addedMonitorCandidate = addedMonitors.find((monitor) => !monitor.isPrimary) ?? addedMonitors[0];
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
      monitorId: projectorMonitorId,
      role: "projector",
      enabled: true,
    },
  ];
  if (existingReturnConfig?.monitorId) {
    resolverConfigs.push({
      id: 0,
      monitorId: existingReturnConfig.monitorId,
      role: "return",
      enabled: true,
    });
  }
  const resolvedIndexes = resolveProjectionMonitorIndexes(monitors, resolverConfigs);
  const fallbackReturnMonitorId = monitors.find((monitor) => monitor.id !== projectorMonitorId)?.id ?? projectorMonitorId;
  const returnMonitorId = resolvedIndexes
    ? (monitors[resolvedIndexes.returnIndex]?.id ?? fallbackReturnMonitorId)
    : fallbackReturnMonitorId;

  const currentProjectorMonitorId = configs.find((config) => config.role === "projector" && config.enabled)?.monitorId;
  const currentReturnMonitorId = configs.find((config) => config.role === "return" && config.enabled)?.monitorId;
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
  monitors: MonitorInfo[] = [],
): number {
  const configuredMonitorId = configs
    .find((config) => config.role === role && config.enabled)
    ?.monitorId;

  if (configuredMonitorId == null) {
    return Math.max(0, Math.min(fallbackIndex, monitorCount - 1));
  }

  // 1. Exact match
  const configuredIndex = monitorIndexById.get(configuredMonitorId);
  if (configuredIndex != null && Number.isFinite(configuredIndex)) {
    return configuredIndex;
  }

  // 2. Fuzzy match for structured v2 IDs (monitor-v2|name_hash|width|height|x|y)
  if (configuredMonitorId.startsWith("monitor-v2|") && monitors.length > 0) {
    const parts = configuredMonitorId.split("|");
    if (parts.length === 6) {
      const nameHash = parts[1];
      const width = parseInt(parts[2], 10);
      const height = parseInt(parts[3], 10);
      const x = parseInt(parts[4], 10);
      const y = parseInt(parts[5], 10);

      const candidates = monitors.map((m, i) => ({ m, i })).filter(({ m }) => {
        // We can't easily re-hash the name in JS exactly like Rust's DefaultHasher,
        // but we can trust the ID the backend gave us earlier if it matches.
        // Wait, if we can't re-hash, how do we match?
        // Actually, we can check if any current monitor has a v2 ID with the same nameHash, width, height.
        if (!m.id.startsWith("monitor-v2|")) return false;
        const mParts = m.id.split("|");
        return mParts[1] === nameHash && parseInt(mParts[2], 10) === width && parseInt(mParts[3], 10) === height;
      });

      if (candidates.length > 0) {
        // Pick the one closest to original position
        const best = candidates.reduce((prev, curr) => {
          const prevDist = Math.abs(curr.m.x - x) + Math.abs(curr.m.y - y);
          const currDist = Math.abs(prev.m.x - x) + Math.abs(prev.m.y - y);
          return prevDist < currDist ? prev : curr;
        });
        return best.i;
      }
    }
  }

  // 3. Legacy index match (monitor-0, monitor-1...)
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

  const externalIndex = monitors.findIndex((monitor) => !monitor.isPrimary);
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
