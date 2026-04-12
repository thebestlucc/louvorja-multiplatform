import { useEffect, useState } from "react";
import { Monitor, Music, Search, Settings, Tv } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { BottomTab } from "@/components/ui/bottom-tab";
import PairRoute from "./pair";
import LiveRoute from "./live";
import SearchRoute from "./search";
import ServiceRoute from "./service";
import QueueRoute from "./queue";
import SettingsRoute from "./settings";

type Tab = "live" | "search" | "service" | "queue" | "settings";

const TABS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "live", label: "Live", Icon: ({ className }) => <Monitor className={className} /> },
  { id: "search", label: "Search", Icon: ({ className }) => <Search className={className} /> },
  { id: "service", label: "Service", Icon: ({ className }) => <Tv className={className} /> },
  { id: "queue", label: "Queue", Icon: ({ className }) => <Music className={className} /> },
  { id: "settings", label: "Settings", Icon: ({ className }) => <Settings className={className} /> },
];

function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case "live": return <LiveRoute />;
    case "search": return <SearchRoute />;
    case "service": return <ServiceRoute />;
    case "queue": return <QueueRoute />;
    case "settings": return <SettingsRoute />;
  }
}

export default function RootLayout() {
  const { isPaired, init } = useConnectionStore();
  const [activeTab, setActiveTab] = useState<Tab>("live");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    init().then(() => setInitialized(true));
  }, [init]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-fg-subtle text-sm">Loading…</div>
      </div>
    );
  }

  if (!isPaired) {
    return <PairRoute />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <TabContent tab={activeTab} />
      </main>

      {/* Bottom tab bar */}
      <nav
        className="flex border-t border-border bg-surface-1 safe-bottom"
        role="tablist"
        aria-label="Main navigation"
      >
        {TABS.map(({ id, label, Icon }) => (
          <BottomTab
            key={id}
            label={label}
            icon={<Icon className="h-5 w-5" />}
            active={activeTab === id}
            onClick={() => setActiveTab(id)}
            aria-controls={`tab-panel-${id}`}
          />
        ))}
      </nav>
    </div>
  );
}
