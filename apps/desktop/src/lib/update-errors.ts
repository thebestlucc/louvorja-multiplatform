export type UpdateErrorCategory = "network" | "disk_space" | "permission" | "generic";

interface PastoralError {
  titleKey: string;
  whyKey: string;
  actionKey: string;
  reassuranceKey: string;
}

const CATEGORY_PATTERNS: [UpdateErrorCategory, RegExp][] = [
  ["network", /network|connection|timeout|dns|fetch/i],
  ["disk_space", /space|disk|enospc|storage/i],
  ["permission", /permission|access|eacces|denied/i],
];

const CATEGORY_KEYS: Record<UpdateErrorCategory, PastoralError> = {
  network: { titleKey: "updater.errorNetwork", whyKey: "updater.errorNetworkWhy", actionKey: "updater.errorNetworkAction", reassuranceKey: "updater.errorDataSafe" },
  disk_space: { titleKey: "updater.errorDiskSpace", whyKey: "updater.errorDiskSpaceWhy", actionKey: "updater.errorDiskSpaceAction", reassuranceKey: "updater.errorDataSafe" },
  permission: { titleKey: "updater.errorPermission", whyKey: "updater.errorPermissionWhy", actionKey: "updater.errorPermissionAction", reassuranceKey: "updater.errorDataSafe" },
  generic: { titleKey: "updater.errorGeneric", whyKey: "updater.errorGenericWhy", actionKey: "updater.errorGenericAction", reassuranceKey: "updater.errorDataSafe" },
};

export function classifyUpdateError(error: unknown): PastoralError {
  const msg = String(error);
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(msg)) return CATEGORY_KEYS[category];
  }
  return CATEGORY_KEYS.generic;
}
