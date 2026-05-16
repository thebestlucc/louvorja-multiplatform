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

/** Broadcasts projection display settings to all windows via Rust's global app.emit(). */
export async function broadcastProjectionDisplay(fontSize: number, fontFamily: string): Promise<void> {
  return tauriInvoke<void>("broadcast_projection_display", { fontSize, fontFamily });
}

/** Broadcasts full projection + lyrics display settings to all windows. */
export async function broadcastProjectionDisplayFull(
  fontSize: number,
  fontFamily: string,
  lyricsSettings: {
    textColor: string;
    backgroundColor: string;
    enableBackgroundImage: boolean;
    enableBackdropFilter: boolean;
    backdropOpacity: number;
    panelOpacity: number;
  },
): Promise<void> {
  return tauriInvoke<void>("broadcast_projection_display_full", {
    fontSize,
    fontFamily,
    textColor: lyricsSettings.textColor,
    backgroundColor: lyricsSettings.backgroundColor,
    enableBackgroundImage: lyricsSettings.enableBackgroundImage,
    enableBackdropFilter: lyricsSettings.enableBackdropFilter,
    backdropOpacity: lyricsSettings.backdropOpacity,
    panelOpacity: lyricsSettings.panelOpacity,
  });
}
