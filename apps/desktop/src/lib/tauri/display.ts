import { invoke } from "@tauri-apps/api/core";
import type {
  MonitorInfo,
  SlideContent,
  SlideContext,
  OverlayState,
  MonitorConfig,
  ProjectionSnapshot,
} from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Display
export async function getAvailableMonitors(): Promise<MonitorInfo[]> {
  return tauriInvoke<MonitorInfo[]>("get_available_monitors");
}

export async function openProjectorWindow(monitorId: string): Promise<void> {
  return tauriInvoke<void>("open_projector_window", { monitorId });
}

export async function closeProjectorWindow(): Promise<void> {
  return tauriInvoke<void>("close_projector_window");
}

export async function setCurrentSlide(slideData: SlideContent): Promise<void> {
  return tauriInvoke<void>("set_current_slide", { slideData });
}

export async function setSlideOnProjector(slideData: SlideContent): Promise<void> {
  return tauriInvoke<void>("set_slide_on_projector", { slideData });
}

export async function setSlideOnReturn(slideData: SlideContent): Promise<void> {
  return tauriInvoke<void>("set_slide_on_return", { slideData });
}

export async function getCurrentSlide(): Promise<{ slide: SlideContent | null; version: number }> {
  return tauriInvoke<{ slide: SlideContent | null; version: number }>("get_current_slide");
}

export async function getProjectionSnapshot(): Promise<ProjectionSnapshot> {
  return tauriInvoke<ProjectionSnapshot>("get_projection_snapshot");
}

export async function clearCurrentSlide(): Promise<void> {
  return tauriInvoke<void>("clear_current_slide");
}

export async function openReturnWindow(monitorId: string): Promise<void> {
  return tauriInvoke<void>("open_return_window", { monitorId });
}

export async function closeReturnWindow(): Promise<void> {
  return tauriInvoke<void>("close_return_window");
}

export async function toggleBlackScreen(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("toggle_black_screen");
}

export async function toggleLogoScreen(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("toggle_logo_screen");
}

export async function getOverlayState(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("get_overlay_state");
}

export async function setAlert(text: string, isTicker: boolean): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("set_alert", { text, isTicker });
}

export async function clearAlert(): Promise<OverlayState> {
  return tauriInvoke<OverlayState>("clear_alert");
}

export async function identifyMonitors(): Promise<void> {
  return tauriInvoke<void>("identify_monitors");
}

export async function setSlideContext(contextData: SlideContext): Promise<void> {
  return tauriInvoke<void>("set_slide_context", { contextData });
}

export async function getSlideContext(): Promise<SlideContext | null> {
  return tauriInvoke<SlideContext | null>("get_slide_context");
}

export async function setIsFrozen(frozen: boolean): Promise<void> {
  return tauriInvoke<void>("set_is_frozen", { frozen });
}

export async function setMonitorConfig(monitorId: string, role: string): Promise<void> {
  return tauriInvoke<void>("set_monitor_config", { monitorId, role });
}

export async function getMonitorConfigs(): Promise<MonitorConfig[]> {
  return tauriInvoke<MonitorConfig[]>("get_monitor_configs");
}
