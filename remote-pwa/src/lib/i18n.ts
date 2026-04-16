import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import es from "@/locales/es.json";

const LANG_KEY = "louvorja-remote:lang";

function detectLanguage(): string {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && ["en", "pt", "es"].includes(saved)) return saved;
  const browser = navigator.language ?? "en";
  if (browser.startsWith("pt")) return "pt";
  if (browser.startsWith("es")) return "es";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
    es: { translation: es },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/** Change language and persist the choice to localStorage. */
export function setLanguage(lang: string): void {
  localStorage.setItem(LANG_KEY, lang);
  i18n.changeLanguage(lang);
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
] as const;

export default i18n;
