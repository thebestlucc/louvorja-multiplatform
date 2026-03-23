import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Wifi, Palette, Film, Monitor, Sliders, Keyboard, Database, RefreshCw } from "lucide-react";
import { ShortcutsTab } from "../../components/settings/shortcuts-tab";
import { GeneralSection } from "../../components/settings/general-section";
import { AppearanceSection } from "../../components/settings/appearance-section";
import { MonitorSection } from "../../components/settings/monitor-section";
import { StreamingSection } from "../../components/settings/streaming-section";
import { SyncSection } from "../../components/settings/sync-section";
import { DataSection } from "../../components/settings/data-section";
import { YouTubeSection } from "../../components/settings/youtube-section";
import { cn } from "../../lib/utils";

type SettingsTab = "general" | "appearance" | "shortcuts" | "monitor" | "streaming" | "sync" | "youtube" | "data";

interface SettingsSearch {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/settings/")({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      tab: search.tab as SettingsTab | undefined,
    };
  },
  component: SettingsIndex,
});

const SETTINGS_TABS: { id: SettingsTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: Sliders },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
  { id: "shortcuts", labelKey: "settings.tabs.shortcuts", icon: Keyboard },
  { id: "monitor", labelKey: "settings.tabs.monitor", icon: Monitor },
  { id: "streaming", labelKey: "settings.tabs.streaming", icon: Wifi },
  { id: "sync", labelKey: "settings.tabs.sync", icon: RefreshCw },
  { id: "youtube", labelKey: "settings.tabs.youtube", icon: Film },
  { id: "data", labelKey: "settings.tabs.data", icon: Database },
];

function SettingsIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeTab = search.tab ?? "general";

  const setActiveTab = (tab: SettingsTab) => {
    navigate({
      to: "/settings",
      search: { tab },
      replace: true,
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      <nav className="w-52 flex-shrink-0 border-r border-border bg-surface p-3">
        <h1 className="mb-3 px-3 text-lg font-semibold">{t("nav.settings")}</h1>
        <ul className="space-y-1">
          {SETTINGS_TABS.map(({ id, labelKey, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  activeTab === id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {t(labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === "general" && <GeneralSection />}
        {activeTab === "appearance" && <AppearanceSection />}
        {activeTab === "shortcuts" && <ShortcutsTab />}
        {activeTab === "monitor" && <MonitorSection />}
        {activeTab === "streaming" && <StreamingSection />}
        {activeTab === "sync" && <SyncSection />}
        {activeTab === "youtube" && <YouTubeSection />}
        {activeTab === "data" && <DataSection />}
      </main>
    </div>
  );
}
