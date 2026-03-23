import { Outlet, createFileRoute, useRouterState, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { FolderOpen, Video } from "lucide-react";

export const Route = createFileRoute("/collections")({
  component: CollectionsLayout,
});

const TABS = [
  { to: "/collections", icon: FolderOpen, labelKey: "nav.collectionsItems" },
  { to: "/collections/online-videos", icon: Video, labelKey: "nav.onlineVideos" },
] as const;

function CollectionsLayout() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Only show tabs on index pages, not on detail pages
  const showTabs =
    pathname === "/collections" ||
    pathname === "/collections/" ||
    pathname === "/collections/online-videos" ||
    pathname === "/collections/online-videos/";

  if (!showTabs) {
    return <Outlet />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-4 pt-2">
        {TABS.map((tab) => {
          const isActive = pathname === tab.to || pathname === tab.to + "/";
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                "hover:text-foreground",
                isActive
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
