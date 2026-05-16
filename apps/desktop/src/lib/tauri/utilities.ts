import { invoke } from "@tauri-apps/api/core";
import type { TimerMode, TimerStateData, VideoMetadata } from "../bindings";
import type { TextFormat } from "../../types/utilities";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Utilities
export async function startTimer(mode: TimerMode, durationMs?: number | null): Promise<void> {
  return tauriInvoke<void>("start_timer", { mode, durationMs: durationMs ?? null });
}

export async function pauseTimer(): Promise<void> {
  return tauriInvoke<void>("pause_timer");
}

export async function resumeTimer(): Promise<void> {
  return tauriInvoke<void>("resume_timer");
}

export async function resetTimer(): Promise<void> {
  return tauriInvoke<void>("reset_timer");
}

export async function adjustCountdownTimer(deltaMs: number): Promise<void> {
  return tauriInvoke<void>("adjust_countdown_timer", { deltaMs });
}

export async function getTimerState(): Promise<TimerStateData> {
  return tauriInvoke<TimerStateData>("get_timer_state");
}

export async function addLap(): Promise<number> {
  return tauriInvoke<number>("add_lap");
}

export async function startCountdownProjection(
  contextTitle: string,
  countdownTitle: string,
  initialTimeMs: number,
): Promise<void> {
  return tauriInvoke<void>("start_countdown_projection", {
    contextTitle,
    countdownTitle,
    initialTimeMs,
  });
}

export async function startStopwatchProjection(
  contextTitle: string,
  stopwatchTitle: string,
  initialTimeMs: number,
): Promise<void> {
  return tauriInvoke<void>("start_stopwatch_projection", {
    contextTitle,
    stopwatchTitle,
    initialTimeMs,
  });
}

export async function startClockProjection(
  contextTitle: string,
  clockTitle: string,
  use24Hour: boolean,
  showDate: boolean,
): Promise<void> {
  return tauriInvoke<void>("start_clock_projection", {
    contextTitle,
    clockTitle,
    use24Hour,
    showDate,
  });
}

export async function stopUtilityProjection(): Promise<void> {
  return tauriInvoke<void>("stop_utility_projection");
}

export async function runLottery(names: string[]): Promise<string> {
  return tauriInvoke<string>("run_lottery", { names });
}

export async function formatText(text: string, format: TextFormat): Promise<string> {
  return tauriInvoke<string>("format_text", { text, format });
}

// Video
export async function copyImageToMedia(imagePath: string): Promise<string> {
  return tauriInvoke<string>("copy_image_to_media", { imagePath });
}

export async function copyVideoToMedia(videoPath: string): Promise<string> {
  return tauriInvoke<string>("copy_video_to_media", { videoPath });
}

export async function getVideoMetadata(path: string): Promise<VideoMetadata> {
  return tauriInvoke<VideoMetadata>("get_video_metadata", { path });
}

export async function openAppDataFolder(): Promise<void> {
  return tauriInvoke<void>("open_app_data_folder");
}

export async function updateGlobalShortcut(
  action: string,
  shortcutStr: string,
): Promise<void> {
  return tauriInvoke<void>("update_global_shortcut", { action, shortcutStr });
}

export async function spotlightOpen(): Promise<void> {
  return tauriInvoke<void>("spotlight_open");
}

export async function spotlightSelect(
  kind: "navigate" | "action" | "hide",
  payload: string,
): Promise<void> {
  return tauriInvoke<void>("spotlight_select", { kind, payload });
}

export async function spotlightHide(): Promise<void> {
  return tauriInvoke<void>("spotlight_hide");
}
