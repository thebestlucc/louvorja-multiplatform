import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Music, Search, Settings, Tv } from "lucide-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useConnectionStore } from "@/stores/connection-store";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { cn } from "@/lib/utils";
import PairRoute from "./pair";

type Tab = "live" | "search" | "service" | "queue" | "settings";

const TAB_ICONS: Record<Tab, React.FC<{ className?: string }>> = {
  live: ({ className }) => <Monitor className={className} />,
  search: ({ className }) => <Search className={className} />,
  service: ({ className }) => <Tv className={className} />,
  queue: ({ className }) => <Music className={className} />,
  settings: ({ className }) => <Settings className={className} />,
};

const TAB_IDS: Tab[] = ["live", "search", "service", "queue", "settings"];

export default function RootLayout() {
  const { t } = useTranslation();
  const { isPaired, init } = useConnectionStore();
  const [initialized, setInitialized] = useState(false);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useWakeLock();

  useEffect(() => {
    init().then(() => setInitialized(true));
  }, [init]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-fg-subtle text-sm">{t("remote.loading")}</div>
      </div>
    );
  }

  if (!isPaired) {
    return <PairRoute />;
  }

  // Determine active tab from pathname. Default to "live" (matches "/" redirect target).
  const activeTab: Tab = (() => {
    const seg = pathname.split("/")[1] ?? "";
    if ((TAB_IDS as string[]).includes(seg)) return seg as Tab;
    return "live";
  })();

  return (
    <div className="flex flex-col h-full mx-auto w-full max-w-md md:max-w-lg border-x border-border/40">
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav
        className="flex border-t border-border bg-surface-1 safe-bottom"
        role="tablist"
        aria-label="Main navigation"
      >
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICONS[id];
          const active = activeTab === id;
          return (
            <Link
              key={id}
              to={`/${id}`}
              role="tab"
              aria-selected={active}
              aria-controls={`tab-panel-${id}`}
              className={cn(
                "flex flex-col items-center justify-center gap-1",
                "flex-1 min-h-[56px] py-2 px-1",
                "text-xs font-medium transition-colors duration-[120ms]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                active ? "text-primary" : "text-fg-muted hover:text-fg",
              )}
            >
              <span className="h-6 w-6 flex items-center justify-center" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <span>{t(`remote.nav.${id}`)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
