import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { catcher } from "./catcher";
import { getPreference, setPreference } from "./store";
import { broadcastProjectionDisplay } from "./tauri/settings";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRESENTATION_FONT_SIZE_KEY = "presentation.defaultFontSize";
export const DEFAULT_PRESENTATION_FONT_SIZE = 48;

export const PROJECTION_FONT_FAMILY_KEY = "presentation.defaultFontFamily";
/** Sentinel value meaning "use the OS/browser default font" (Radix Select forbids empty string). */
export const DEFAULT_PROJECTION_FONT_FAMILY = "__system__";

export const PROJECTION_DISPLAY_EVENT = "projection-display-changed";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectionDisplaySettings {
  fontSize: number;
  fontFamily: string;
}

// ─── Font family options ──────────────────────────────────────────────────────

export const FONT_FAMILY_OPTIONS = [
  { value: "__system__", label: "System Default" },
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Verdana", label: "Verdana" },
  { value: "Georgia", label: "Georgia" },
  { value: "Palatino Linotype", label: "Palatino" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
];

/** Normalizes a stored font-family value — converts legacy `""` to the `__system__` sentinel. */
function normalizeFontFamily(value: string | null | undefined): string {
  if (!value || value === "") return DEFAULT_PROJECTION_FONT_FAMILY;
  return value;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Read-only hook: returns global projection display settings (fontSize + fontFamily).
 * Loads from plugin-store on mount and stays in sync via the
 * `projection-display-changed` Tauri event emitted by `useProjectionDisplaySetting`.
 */
export function useProjectionDisplay(): ProjectionDisplaySettings {
  const [settings, setSettings] = useState<ProjectionDisplaySettings>({
    fontSize: DEFAULT_PRESENTATION_FONT_SIZE,
    fontFamily: DEFAULT_PROJECTION_FONT_FAMILY,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [fontSize] = await catcher(
        getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
      );
      const [fontFamily] = await catcher(
        getPreference<string>(PROJECTION_FONT_FAMILY_KEY, DEFAULT_PROJECTION_FONT_FAMILY),
      );
      if (!cancelled) {
        setSettings({
          fontSize: fontSize ?? DEFAULT_PRESENTATION_FONT_SIZE,
          fontFamily: normalizeFontFamily(fontFamily),
        });
      }
    };
    void load();

    // Safe promise pattern: .catch(() => () => {}) prevents unhandled rejections;
    // cleanup always eventually calls the unlisten function.
    const unsub = listen<ProjectionDisplaySettings>(PROJECTION_DISPLAY_EVENT, (event) => {
      if (!cancelled) setSettings(event.payload); // guard against post-unmount state update
    }).catch(() => () => {});

    return () => {
      cancelled = true;
      void unsub.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return settings;
}

/**
 * Read-write hook for the settings UI.
 * Loads both font size and font family from plugin-store on mount.
 * `update()` persists both values to plugin-store AND emits
 * `projection-display-changed` so all `useProjectionDisplay()` consumers
 * update in real time across windows.
 */
export function useProjectionDisplaySetting() {
  const [settings, setSettings] = useState<ProjectionDisplaySettings>({
    fontSize: DEFAULT_PRESENTATION_FONT_SIZE,
    fontFamily: DEFAULT_PROJECTION_FONT_FAMILY,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [fontSize] = await catcher(
        getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
      );
      const [fontFamily] = await catcher(
        getPreference<string>(PROJECTION_FONT_FAMILY_KEY, DEFAULT_PROJECTION_FONT_FAMILY),
      );
      setSettings({
        fontSize: fontSize ?? DEFAULT_PRESENTATION_FONT_SIZE,
        fontFamily: fontFamily ?? DEFAULT_PROJECTION_FONT_FAMILY,
      });
      setLoaded(true);
    };
    void load();
  }, []);

  const update = (next: ProjectionDisplaySettings) => {
    setSettings(next);
    void catcher(setPreference(PRESENTATION_FONT_SIZE_KEY, next.fontSize));
    void catcher(setPreference(PROJECTION_FONT_FAMILY_KEY, next.fontFamily));
    // Route broadcast through Rust so app.emit() reaches all webview windows
    void catcher(broadcastProjectionDisplay(next.fontSize, next.fontFamily));
  };

  return { settings, update, loaded };
}

// ─── Backward-compat wrappers ─────────────────────────────────────────────────

/** @deprecated Use `useProjectionDisplay()` instead. */
export function usePresentationFontSize(): number {
  return useProjectionDisplay().fontSize;
}

/**
 * @deprecated Use `useProjectionDisplaySetting()` instead.
 * Note: `updateFontSize` closes over `settings` at render time — avoid
 * memoizing the returned function with a stale deps array.
 */
export function usePresentationFontSizeSetting() {
  const { settings, update, loaded } = useProjectionDisplaySetting();
  const updateFontSize = (val: number) => update({ ...settings, fontSize: val });
  return { fontSize: settings.fontSize, updateFontSize, loaded };
}
