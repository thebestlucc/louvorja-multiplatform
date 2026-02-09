import { create } from "zustand";
import type { Theme, Language } from "../lib/constants";
import { DEFAULT_THEME, DEFAULT_LANGUAGE } from "../lib/constants";
import i18n from "../lib/i18n";

interface ThemeState {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

export const useThemeStore = create<ThemeState>((set) => {
  const savedTheme = (localStorage.getItem("theme") as Theme) || DEFAULT_THEME;
  const savedLang = (localStorage.getItem("language") as Language) || DEFAULT_LANGUAGE;

  applyTheme(savedTheme);

  return {
    theme: savedTheme,
    language: savedLang,
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
    setLanguage: (lang) => {
      localStorage.setItem("language", lang);
      i18n.changeLanguage(lang);
      set({ language: lang });
    },
  };
});
