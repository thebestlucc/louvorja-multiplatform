import { invoke } from "@tauri-apps/api/core";
import type { Setting } from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Settings
export async function getSetting(key: string): Promise<Setting> {
  return tauriInvoke<Setting>("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return tauriInvoke<void>("set_setting", { key, value });
}

export async function getAllSettings(): Promise<Setting[]> {
  return tauriInvoke<Setting[]>("get_all_settings");
}

export async function clearDatabase(): Promise<{ success: boolean }> {
  return tauriInvoke<{ success: boolean }>("clear_database");
}
