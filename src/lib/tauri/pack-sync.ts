import { invoke } from "@tauri-apps/api/core";
import type { UpdateInfo } from "../bindings";
import type { PackSyncPlan, PackSyncPlanItem } from "../../types/content-sync";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Pack Sync
export async function planPackSync(
  forceRefresh?: boolean,
  previewLanguages?: string[] | null,
): Promise<PackSyncPlan> {
  return tauriInvoke<PackSyncPlan>("plan_pack_sync", {
    forceRefresh: forceRefresh ?? false,
    previewLanguages: previewLanguages ?? null,
  });
}

export async function clearManifestCache(): Promise<void> {
  return tauriInvoke<void>("clear_manifest_cache");
}

export async function startPackSync(
  items?: PackSyncPlanItem[] | null,
  selectedLanguages?: string[] | null,
): Promise<string> {
  return tauriInvoke<string>("start_pack_sync", {
    items: items ?? null,
    selectedLanguages: selectedLanguages ?? null,
  });
}

export async function cancelPackSync(runId: string): Promise<void> {
  return tauriInvoke<void>("cancel_pack_sync", { runId });
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  return tauriInvoke<UpdateInfo | null>("check_for_updates");
}

export async function installUpdate(): Promise<void> {
  return tauriInvoke<void>("install_update");
}
