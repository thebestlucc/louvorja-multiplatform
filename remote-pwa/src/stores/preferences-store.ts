/**
 * Preferences store — persists user settings to localStorage.
 * Covers: theme, wake lock, haptic feedback.
 */

import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

export interface PreferencesState {
  theme: Theme;
  wakeLock: boolean;
  haptics: boolean;
}

interface PreferencesActions {
  setTheme: (theme: Theme) => void;
  setWakeLock: (enabled: boolean) => void;
  setHaptics: (enabled: boolean) => void;
}

const STORAGE_KEY = "louvorja-remote-prefs";

function loadPrefs(): PreferencesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PreferencesState>;
      return {
        theme: (parsed.theme as Theme) ?? "system",
        wakeLock: parsed.wakeLock ?? false,
        haptics: parsed.haptics ?? true,
      };
    }
  } catch {
    // ignore parse errors
  }
  return { theme: "system", wakeLock: false, haptics: true };
}

function savePrefs(state: PreferencesState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

const initial = loadPrefs();

export const usePreferencesStore = create<PreferencesState & PreferencesActions>((set, get) => ({
  ...initial,

  setTheme: (theme) => {
    set({ theme });
    savePrefs({ ...get(), theme });
    applyTheme(theme);
  },

  setWakeLock: (wakeLock) => {
    set({ wakeLock });
    savePrefs({ ...get(), wakeLock });
  },

  setHaptics: (haptics) => {
    set({ haptics });
    savePrefs({ ...get(), haptics });
  },
}));

// ─── Theme application ────────────────────────────────────────────────────────

const mediaQuery =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system
    if (mediaQuery?.matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

// Apply on load.
applyTheme(initial.theme);

// Re-apply when OS preference changes (only relevant when theme === "system").
if (mediaQuery) {
  mediaQuery.addEventListener("change", () => {
    const { theme } = usePreferencesStore.getState();
    if (theme === "system") applyTheme("system");
  });
}

// ─── Haptic helper ────────────────────────────────────────────────────────────

/** Trigger a short haptic pulse if haptics are enabled. */
export function triggerHaptic(pattern: number | number[] = 10): void {
  if (!usePreferencesStore.getState().haptics) return;
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
