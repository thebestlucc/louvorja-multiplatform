import { useTranslation } from "react-i18next";
import { Bell, Check, Keyboard, Languages, Palette, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useThemeStore } from "../../stores/theme-store";
import { useContentSyncStore } from "../../stores/content-sync-store";
import {
  type Language,
  LANGUAGES,
  type Theme,
  THEMES,
} from "../../lib/constants";
import { useSetSetting, useSetting, useStartPackSync } from "../../lib/queries";
import { comboToDisplayKeys, normalizeShortcutCombo } from "../../lib/shortcut-definitions";
import { openKeyboardShortcutsPanel } from "../utilities/keyboard-shortcuts-panel";
import { spotlightOpen } from "../../lib/tauri";
import { catcher } from "../../lib/catcher";
import { toast } from "sonner";

function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
}

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function Header() {
  const { t } = useTranslation();
  const { theme, language, setTheme, setLanguage } = useThemeStore();
  const packSyncPendingCount = useContentSyncStore((s) => s.packSyncPendingCount);
  const packSyncPlan = useContentSyncStore((s) => s.packSyncPlan);
  const setPackSyncPendingCount = useContentSyncStore((s) => s.setPackSyncPendingCount);
  const setPackSyncPlan = useContentSyncStore((s) => s.setPackSyncPlan);
  const openPackSyncProgress = useContentSyncStore((s) => s.openPackSyncProgress);
  const [bellOpen, setBellOpen] = useState(false);
  const startPackSync = useStartPackSync();
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
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5">
      <button
        data-tour="search"
        type="button"
        onClick={openCommandPalette}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border bg-muted px-3.5 text-sm text-muted-foreground",
          "hover:bg-surface-hover transition-colors w-72",
        )}
      >
        <Search className="h-4 w-4" />
        <span>{t("actions.search")}...</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {spotlightShortcutLabel}
        </kbd>
      </button>

      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {dateLabel} {timeLabel}
        </span>

        {packSyncPendingCount > 0 && (
          <DropdownMenu open={bellOpen} onOpenChange={setBellOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                aria-label={t("settings.packSync.newPacksAvailable")}
              >
                <Bell className="size-4.5" />
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-surface" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("header.notifications")}
                </p>
              </div>
              <div className="px-3 py-3 space-y-1">
                <p className="text-sm font-medium">{t("settings.packSync.newPacksAvailable")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("header.packNotification", {
                    count: packSyncPlan?.totalDownloadCount ?? packSyncPendingCount,
                    size: packSyncPlan ? formatBytes(packSyncPlan.totalDownloadSize) : "",
                  })}
                </p>
              </div>
              <div className="flex gap-2 border-t border-border px-3 py-2.5">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={startPackSync.isPending}
                  onClick={async () => {
                    const plan = useContentSyncStore.getState().packSyncPlan;
                    const [runId, err] = await catcher(
                      startPackSync.mutateAsync({
                        items: plan?.items,
                        selectedLanguages: plan?.selectedLanguages?.length ? plan.selectedLanguages : null,
                      }),
                    );
                    if (err) { toast.error(String(err)); return; }
                    if (runId) useContentSyncStore.getState().setPackSyncRunId(runId);
                    // Hide bell after sync starts — it will reappear on next app launch if needed
                    setPackSyncPendingCount(0);
                    setPackSyncPlan(null);
                    setBellOpen(false);
                    openPackSyncProgress();
                  }}
                >
                  {startPackSync.isPending ? t("settings.packSync.starting") : t("settings.packSync.downloadNow")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={startPackSync.isPending}
                  onClick={() => setBellOpen(false)}
                >
                  {t("settings.packSync.later")}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={shortcutsHelpLabel}
              onClick={openKeyboardShortcutsPanel}
            >
              <Keyboard className="size-4.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{`${shortcutsHelpLabel} (${shortcutsHelpComboLabel})`}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t("settings.language")}
                >
                  <Languages className="size-4.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("settings.language")}</TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t("settings.theme")}
                >
                  <Palette className="size-4.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("settings.theme")}</TooltipContent>
          </Tooltip>
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
