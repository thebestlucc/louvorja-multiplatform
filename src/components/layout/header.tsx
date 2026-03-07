import { useTranslation } from "react-i18next";
import { Check, Keyboard, Languages, Palette, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useThemeStore } from "../../stores/theme-store";
import {
  type Language,
  LANGUAGES,
  type Theme,
  THEMES,
} from "../../lib/constants";
import { useSetSetting, useSetting } from "../../lib/queries";
import { comboToDisplayKeys, normalizeShortcutCombo } from "../../lib/shortcut-definitions";
import { openKeyboardShortcutsPanel } from "../utilities/keyboard-shortcuts-panel";
import { spotlightOpen } from "../../lib/tauri";

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function Header() {
  const { t } = useTranslation();
  const { theme, language, setTheme, setLanguage } = useThemeStore();
  const setSettingMutation = useSetSetting();
  const { data: spotlightShortcutSetting } = useSetting("shortcut.app-command-palette.local");
  const { data: shortcutsHelpSetting } = useSetting("shortcut.app-shortcuts-help.local");
  const [now, setNow] = useState(() => new Date());
  const locale = LOCALE_BY_LANGUAGE[language];

  const languageLabels: Record<Language, string> = {
    pt: t("settings.languagePt"),
    en: t("settings.languageEn"),
    es: t("settings.languageEs"),
  };

  useEffect(() => {
    function tick() {
      setNow(new Date());
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function handleThemeChange(nextTheme: Theme) {
    if (nextTheme === theme) return;
    setTheme(nextTheme);
    setSettingMutation.mutate({ key: "app.theme", value: nextTheme });
  }

  function handleLanguageChange(nextLanguage: Language) {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setSettingMutation.mutate({ key: "app.language", value: nextLanguage });
  }

  function openCommandPalette() {
    void spotlightOpen();
  }

  const dateLabel = now.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeLabel = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const shortcutsHelpLabel = t("commandPalette.actions.openShortcuts");
  const spotlightShortcutLabel = comboToDisplayKeys(
    normalizeShortcutCombo(spotlightShortcutSetting?.value ?? "Meta+k", "local"),
  ).join(" + ");
  const shortcutsHelpComboLabel = comboToDisplayKeys(
    normalizeShortcutCombo(shortcutsHelpSetting?.value ?? "Meta+/", "local"),
  ).join(" + ");

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={openCommandPalette}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground",
          "hover:bg-surface-hover transition-colors w-64",
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>{t("actions.search")}...</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {spotlightShortcutLabel}
        </kbd>
      </button>

      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {dateLabel} {timeLabel}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={shortcutsHelpLabel}
          title={`${shortcutsHelpLabel} (${shortcutsHelpComboLabel})`}
          onClick={openKeyboardShortcutsPanel}
        >
          <Keyboard className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("settings.language")}
              title={t("settings.language")}
            >
              <Languages className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LANGUAGES.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => handleLanguageChange(option)}
                className="flex items-center justify-between gap-2"
              >
                <span>{languageLabels[option]}</span>
                <Check
                  className={cn(
                    "h-4 w-4",
                    option === language ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("settings.theme")}
              title={t("settings.theme")}
            >
              <Palette className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {THEMES.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => handleThemeChange(option)}
                className="flex items-center justify-between gap-2"
              >
                <span>{t(`themes.${option}`)}</span>
                <Check
                  className={cn(
                    "h-4 w-4",
                    option === theme ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
