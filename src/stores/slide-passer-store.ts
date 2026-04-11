import { create } from "zustand";
import { getPreference, setPreference } from "../lib/store";

export interface SlidePasserMappings {
  nextSlide: string;
  prevSlide: string;
  blackScreen: string | null;
  toggleProjection: string | null;
}

export interface SlidePasserConfig {
  enabled: boolean;
  mode: "internal" | "external";
  mappings: SlidePasserMappings;
  externalApp: "powerpoint" | "keynote" | "libreoffice" | "google-slides" | "custom";
  customExternalKeys?: {
    next: string;
    prev: string;
    black: string | null;
    startShow: string | null;
  };
}

const DEFAULT_CONFIG: SlidePasserConfig = {
  enabled: false,
  mode: "internal",
  mappings: {
    nextSlide: "PageDown",
    prevSlide: "PageUp",
    blackScreen: ".",
    toggleProjection: "F5",
  },
  externalApp: "powerpoint",
};

interface SlidePasserState {
  config: SlidePasserConfig;
  lastEventKey: string | null;
  lastEventTimestamp: number | null;
  isActive: boolean;
  loaded: boolean;
  setConfig: (config: Partial<SlidePasserConfig>) => void;
  setEnabled: (enabled: boolean) => void;
  setMode: (mode: "internal" | "external") => void;
  setMapping: (action: keyof SlidePasserMappings, key: string | null) => void;
  setExternalApp: (app: SlidePasserConfig["externalApp"]) => void;
  recordEvent: (key: string) => void;
  clearActive: () => void;
  loadFromStore: () => Promise<void>;
}

const STORE_KEY = "slide_passer_config";

export const useSlidePasserStore = create<SlidePasserState>((set, get) => ({
  config: DEFAULT_CONFIG,
  lastEventKey: null,
  lastEventTimestamp: null,
  isActive: false,
  loaded: false,

  setConfig: (partial) => {
    const newConfig = { ...get().config, ...partial };
    set({ config: newConfig });
    void setPreference(STORE_KEY, newConfig);
  },

  setEnabled: (enabled) => {
    const newConfig = { ...get().config, enabled };
    set({ config: newConfig });
    void setPreference(STORE_KEY, newConfig);
  },

  setMode: (mode) => {
    const newConfig = { ...get().config, mode };
    set({ config: newConfig });
    void setPreference(STORE_KEY, newConfig);
  },

  setMapping: (action, key) => {
    const newMappings = { ...get().config.mappings, [action]: key };
    const newConfig = { ...get().config, mappings: newMappings };
    set({ config: newConfig });
    void setPreference(STORE_KEY, newConfig);
  },

  setExternalApp: (app) => {
    const newConfig = { ...get().config, externalApp: app };
    set({ config: newConfig });
    void setPreference(STORE_KEY, newConfig);
  },

  recordEvent: (key) => {
    set({ lastEventKey: key, lastEventTimestamp: Date.now(), isActive: true });
  },

  clearActive: () => set({ isActive: false }),

  loadFromStore: async () => {
    const saved = await getPreference<SlidePasserConfig | null>(STORE_KEY, null);
    if (saved) {
      set({
        config: {
          ...DEFAULT_CONFIG,
          ...saved,
          mappings: { ...DEFAULT_CONFIG.mappings, ...saved.mappings },
        },
        loaded: true,
      });
    } else {
      set({ loaded: true });
    }
  },
}));
