import { invoke } from "@tauri-apps/api/core";
import type { AudioStatusPayload, SyncPoint } from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Audio
export async function audioPlay(
  filePath: string,
  positionMs?: number | null,
  preserveLivePosition?: boolean | null,
): Promise<void> {
  return tauriInvoke<void>("audio_play", {
    filePath,
    positionMs: positionMs ?? null,
    preserveLivePosition: preserveLivePosition ?? null,
  });
}

export async function audioPlayVariants(
  sungFilePath: string,
  karaokeFilePath: string,
  activeMode: "sung" | "karaoke",
  positionMs?: number | null,
): Promise<void> {
  return tauriInvoke<void>("audio_play_variants", {
    sungFilePath,
    karaokeFilePath,
    activeMode,
    positionMs: positionMs ?? null,
  });
}

export async function audioPlayAlert(filePath?: string | null, volume?: number | null): Promise<void> {
  return tauriInvoke<void>("audio_play_alert", {
    filePath: filePath ?? null,
    volume: volume ?? null,
  });
}

export async function audioPause(): Promise<void> {
  return tauriInvoke<void>("audio_pause");
}

export async function audioResume(): Promise<void> {
  return tauriInvoke<void>("audio_resume");
}

export async function audioSetOutputMuted(muted: boolean): Promise<void> {
  return tauriInvoke<void>("audio_set_output_muted", { muted });
}

export async function audioSwitchVariant(activeMode: "sung" | "karaoke"): Promise<void> {
  return tauriInvoke<void>("audio_switch_variant", { activeMode });
}

export async function audioStop(): Promise<void> {
  return tauriInvoke<void>("audio_stop");
}

export async function audioSeek(positionMs: number): Promise<void> {
  return tauriInvoke<void>("audio_seek", { positionMs });
}

export async function audioSetVolume(volume: number): Promise<void> {
  return tauriInvoke<void>("audio_set_volume", { volume });
}

export async function audioGetPosition(): Promise<number> {
  return tauriInvoke<number>("audio_get_position");
}

export async function audioGetStatus(): Promise<AudioStatusPayload> {
  return tauriInvoke<AudioStatusPayload>("audio_get_status");
}

// Sync Points
export async function getSyncPoints(hymnId: number): Promise<SyncPoint[]> {
  return tauriInvoke<SyncPoint[]>("get_sync_points", { hymnId });
}

export async function saveSyncPoints(hymnId: number, points: SyncPoint[]): Promise<void> {
  return tauriInvoke<void>("save_sync_points", { hymnId, points });
}
