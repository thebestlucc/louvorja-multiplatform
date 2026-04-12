import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { catcher } from "./catcher";
import { getPreference, setPreference } from "./store";
import { broadcastProjectionDisplayFull } from "./tauri/settings";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRESENTATION_FONT_SIZE_KEY = "presentation.defaultFontSize";
export const DEFAULT_PRESENTATION_FONT_SIZE = 48;

export const PROJECTION_FONT_FAMILY_KEY = "presentation.defaultFontFamily";
/** Sentinel value meaning "use the OS/browser default font" (Radix Select forbids empty string). */
export const DEFAULT_PROJECTION_FONT_FAMILY = "__system__";

// Lyrics display customization keys
export const LYRICS_TEXT_COLOR_KEY = "lyrics.textColor";
export const DEFAULT_LYRICS_TEXT_COLOR = "#ffffff";

export const LYRICS_BG_COLOR_KEY = "lyrics.backgroundColor";
export const DEFAULT_LYRICS_BG_COLOR = "#1a1a2e";

export const LYRICS_ENABLE_BG_IMAGE_KEY = "lyrics.enableBackgroundImage";
export const DEFAULT_LYRICS_ENABLE_BG_IMAGE = true;

export const LYRICS_ENABLE_BACKDROP_KEY = "lyrics.enableBackdropFilter";
export const DEFAULT_LYRICS_ENABLE_BACKDROP = true;

export const LYRICS_BACKDROP_OPACITY_KEY = "lyrics.backdropOpacity";
export const DEFAULT_LYRICS_BACKDROP_OPACITY = 40;

export const LYRICS_PANEL_OPACITY_KEY = "lyrics.panelOpacity";
export const DEFAULT_LYRICS_PANEL_OPACITY = 68;

// Note: lyrics font-size reuses the projection font-size (PRESENTATION_FONT_SIZE_KEY).
// The Projection section slider controls the base size for ALL projected content.

export const PROJECTION_DISPLAY_EVENT = "projection-display-changed";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectionDisplaySettings {
  fontSize: number;
  fontFamily: string;
}

export interface LyricsDisplaySettings {
  textColor: string;
  backgroundColor: string;
  enableBackgroundImage: boolean;
  enableBackdropFilter: boolean;
  backdropOpacity: number;
  panelOpacity: number;
}

/** Combined event payload broadcast over `projection-display-changed`. */
export type FullProjectionSettings = ProjectionDisplaySettings & LyricsDisplaySettings;

// ─── Font family options ──────────────────────────────────────────────────────

export const FONT_FAMILY_OPTIONS = [
  { value: "__system__", label: "System Default" },
  { value: "Inter", label: "Inter" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Roboto", label: "Roboto" },
  { value: "Playfair Display", label: "Playfair Display" },
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
    load();

    // Safe promise pattern: .catch(() => () => {}) prevents unhandled rejections;
    // cleanup always eventually calls the unlisten function.
    const unsub = listen<ProjectionDisplaySettings>(PROJECTION_DISPLAY_EVENT, (event) => {
      if (!cancelled) setSettings(event.payload); // guard against post-unmount state update
    }).catch(() => () => {});

    return () => {
      cancelled = true;
      unsub.then((fn) => fn()).catch(() => {});
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
    load();
  }, []);

  const update = async (next: ProjectionDisplaySettings) => {
    setSettings(next);
    await catcher(setPreference(PRESENTATION_FONT_SIZE_KEY, next.fontSize));
    await catcher(setPreference(PROJECTION_FONT_FAMILY_KEY, next.fontFamily));
    // Read current lyrics prefs from store and broadcast combined payload
    const lyrics = await loadLyricsPrefs();
    catcher(broadcastProjectionDisplayFull(next.fontSize, next.fontFamily, lyrics));
  };

  return { settings, update, loaded };
}

// ─── Lyrics Display Settings Hook ─────────────────────────────────────────────

// ─── Shared loader ────────────────────────────────────────────────────────────

async function loadLyricsPrefs(): Promise<LyricsDisplaySettings> {
  const [
    [textColor],
    [backgroundColor],
    [enableBackgroundImage],
    [enableBackdropFilter],
    [backdropOpacity],
    [panelOpacity],
  ] = await Promise.all([
    catcher(getPreference<string>(LYRICS_TEXT_COLOR_KEY, DEFAULT_LYRICS_TEXT_COLOR)),
    catcher(getPreference<string>(LYRICS_BG_COLOR_KEY, DEFAULT_LYRICS_BG_COLOR)),
    catcher(getPreference<boolean>(LYRICS_ENABLE_BG_IMAGE_KEY, DEFAULT_LYRICS_ENABLE_BG_IMAGE)),
    catcher(getPreference<boolean>(LYRICS_ENABLE_BACKDROP_KEY, DEFAULT_LYRICS_ENABLE_BACKDROP)),
    catcher(getPreference<number>(LYRICS_BACKDROP_OPACITY_KEY, DEFAULT_LYRICS_BACKDROP_OPACITY)),
    catcher(getPreference<number>(LYRICS_PANEL_OPACITY_KEY, DEFAULT_LYRICS_PANEL_OPACITY)),
  ]);
  return {
    textColor: textColor ?? DEFAULT_LYRICS_TEXT_COLOR,
    backgroundColor: backgroundColor ?? DEFAULT_LYRICS_BG_COLOR,
    enableBackgroundImage: enableBackgroundImage ?? DEFAULT_LYRICS_ENABLE_BG_IMAGE,
    enableBackdropFilter: enableBackdropFilter ?? DEFAULT_LYRICS_ENABLE_BACKDROP,
    backdropOpacity: backdropOpacity ?? DEFAULT_LYRICS_BACKDROP_OPACITY,
    panelOpacity: panelOpacity ?? DEFAULT_LYRICS_PANEL_OPACITY,
  };
}

/**
 * Read-only hook: returns lyrics display settings.
 * Loads from plugin-store on mount and stays in sync via the
 * `projection-display-changed` Tauri event.
 */
export function useLyricsDisplay(): LyricsDisplaySettings {
  const [settings, setSettings] = useState<LyricsDisplaySettings>({
    textColor: DEFAULT_LYRICS_TEXT_COLOR,
    backgroundColor: DEFAULT_LYRICS_BG_COLOR,
    enableBackgroundImage: DEFAULT_LYRICS_ENABLE_BG_IMAGE,
    enableBackdropFilter: DEFAULT_LYRICS_ENABLE_BACKDROP,
    backdropOpacity: DEFAULT_LYRICS_BACKDROP_OPACITY,
    panelOpacity: DEFAULT_LYRICS_PANEL_OPACITY,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const prefs = await loadLyricsPrefs();
      if (!cancelled) setSettings(prefs);
    };
    load();

    const unsub = listen<FullProjectionSettings>(PROJECTION_DISPLAY_EVENT, (event) => {
      if (!cancelled) {
        const p = event.payload;
        setSettings({
          textColor: p.textColor ?? DEFAULT_LYRICS_TEXT_COLOR,
          backgroundColor: p.backgroundColor ?? DEFAULT_LYRICS_BG_COLOR,
          enableBackgroundImage: p.enableBackgroundImage ?? DEFAULT_LYRICS_ENABLE_BG_IMAGE,
          enableBackdropFilter: p.enableBackdropFilter ?? DEFAULT_LYRICS_ENABLE_BACKDROP,
          backdropOpacity: p.backdropOpacity ?? DEFAULT_LYRICS_BACKDROP_OPACITY,
          panelOpacity: p.panelOpacity ?? DEFAULT_LYRICS_PANEL_OPACITY,
        });
      }
    }).catch(() => () => {});

    return () => {
      cancelled = true;
      unsub.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return settings;
}

/**
 * Read-write hook for the lyrics settings UI.
 * Loads from plugin-store on mount.
 * `update()` persists values to plugin-store AND emits
 * `projection-display-changed` so all consumers update in real time.
 */
export function useLyricsDisplaySetting() {
  const [settings, setSettings] = useState<LyricsDisplaySettings>({
    textColor: DEFAULT_LYRICS_TEXT_COLOR,
    backgroundColor: DEFAULT_LYRICS_BG_COLOR,
    enableBackgroundImage: DEFAULT_LYRICS_ENABLE_BG_IMAGE,
    enableBackdropFilter: DEFAULT_LYRICS_ENABLE_BACKDROP,
    backdropOpacity: DEFAULT_LYRICS_BACKDROP_OPACITY,
    panelOpacity: DEFAULT_LYRICS_PANEL_OPACITY,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      setSettings(await loadLyricsPrefs());
      setLoaded(true);
    };
    load();
  }, []);

  const update = (next: LyricsDisplaySettings) => {
    setSettings(next);
    catcher(setPreference(LYRICS_TEXT_COLOR_KEY, next.textColor));
    catcher(setPreference(LYRICS_BG_COLOR_KEY, next.backgroundColor));
    catcher(setPreference(LYRICS_ENABLE_BG_IMAGE_KEY, next.enableBackgroundImage));
    catcher(setPreference(LYRICS_ENABLE_BACKDROP_KEY, next.enableBackdropFilter));
    catcher(setPreference(LYRICS_BACKDROP_OPACITY_KEY, next.backdropOpacity));
    catcher(setPreference(LYRICS_PANEL_OPACITY_KEY, next.panelOpacity));
    // Broadcast full settings so all windows update
    broadcastLyricsDisplay(next);
  };

  return { settings, update, loaded };
}

/** Broadcasts lyrics display settings to all windows via Rust's global app.emit(). */
async function broadcastLyricsDisplay(settings: LyricsDisplaySettings): Promise<void> {
  // Read current font settings so we don't reset them when only lyrics settings changed.
  // Both domains share projection-display-changed; the full payload must always be consistent.
  const [[fontSize], [fontFamily]] = await Promise.all([
    catcher(getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE)),
    catcher(getPreference<string>(PROJECTION_FONT_FAMILY_KEY, DEFAULT_PROJECTION_FONT_FAMILY)),
  ]);
  catcher(
    broadcastProjectionDisplayFull(
      fontSize ?? DEFAULT_PRESENTATION_FONT_SIZE,
      fontFamily ?? DEFAULT_PROJECTION_FONT_FAMILY,
      settings,
    ),
  );
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
