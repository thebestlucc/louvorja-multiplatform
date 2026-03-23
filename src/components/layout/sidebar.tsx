import { useRef, useState, useEffect } from "react";
import { Link, useMatchRoute, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Home,
  Music,
  FolderOpen,
  BookOpen,
  Presentation,
  ListChecks,
  MonitorPlay,
  Wrench,
  Settings,
  CircleHelp,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  ChevronDown,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useUIStore } from "../../stores/ui-store";
import { usePresentationStore } from "../../stores/presentation-store";
import { useDisplayStore } from "../../stores/display-store";
import { useService } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

// The projection indicator always points to the Playing Now screen —
// that's where the user goes to control/monitor what's being projected.
const PLAYING_NOW_ROUTE = "/playing-now";

type NavChild = { to: string; icon: LucideIcon; labelKey: string };
type NavItem = { to: string; icon: LucideIcon; labelKey: string; children?: NavChild[] };

const navItems: NavItem[] = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/hymnal", icon: Music, labelKey: "nav.hymnal" },
  {
    to: "/collections",
    icon: FolderOpen,
    labelKey: "nav.collections",
    children: [
      { to: "/collections", icon: FolderOpen, labelKey: "nav.collectionsItems" },
      { to: "/collections/online-videos", icon: Video, labelKey: "nav.onlineVideos" },
    ],
  },
  { to: "/bible", icon: BookOpen, labelKey: "nav.bible" },
  { to: "/presentations", icon: Presentation, labelKey: "nav.presentations" },
  { to: "/services", icon: ListChecks, labelKey: "nav.services" },
  { to: "/playing-now", icon: MonitorPlay, labelKey: "nav.playingNow" },
  { to: "/utilities", icon: Wrench, labelKey: "nav.utilities" },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
  { to: "/help", icon: CircleHelp, labelKey: "nav.help" },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, expandedNavItems, toggleNavItem, setNavItemExpanded } =
    useUIStore();
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);
  const { data: activeServiceData } = useService(activeServiceId ?? 0);
  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const isProjectingAnything = currentProjectionType !== null;
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hover popover state for collapsed sidebar
  const [hoverOpen, setHoverOpen] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (to: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoverOpen(to), 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverOpen(null);
  };

  // Auto-expand parent when current route matches any child
  useEffect(() => {
    for (const item of navItems) {
      if (!item.children) continue;
      const anyChildActive = item.children.some((child) =>
        pathname === child.to || pathname.startsWith(child.to + "/"),
      );
      if (anyChildActive && !expandedNavItems[item.to]) {
        setNavItemExpanded(item.to, true);
      }
    }
    // Only run when pathname changes; intentionally omitting expandedNavItems to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, setNavItemExpanded]);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-surface transition-all duration-200",
        sidebarOpen ? "w-60" : "w-14",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {sidebarOpen && (
          <span className="text-sm font-semibold text-primary">
            {t("app.name")}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="ml-auto h-8 w-8"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const isActive = matchRoute({ to: item.to, fuzzy: hasChildren || item.to !== "/" });
          const isProjecting = item.to === PLAYING_NOW_ROUTE && isProjectingAnything;
          const isExpanded = Boolean(expandedNavItems[item.to]);

          // --- Items WITH children ---
          if (hasChildren) {
            const anyChildActive = item.children!.some((child) =>
              pathname === child.to || pathname.startsWith(child.to + "/"),
            );

            // Collapsed sidebar: show icon with hover popover
            if (!sidebarOpen) {
              return (
                <div
                  key={item.to}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(item.to)}
                  onMouseLeave={handleMouseLeave}
                >
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center justify-center rounded-md px-0 py-2 text-sm font-medium transition-colors",
                      "hover:bg-surface-hover",
                      anyChildActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <div className="relative shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </Link>
                  {hoverOpen === item.to && (
                    <div
                      className="absolute left-full top-0 z-50 ml-2 min-w-44 rounded-lg border border-border bg-surface shadow-lg"
                      onMouseEnter={() => handleMouseEnter(item.to)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="flex flex-col gap-0.5 p-1">
                        {item.children!.map((child) => {
                          const isChildActive =
                            pathname === child.to ||
                            pathname.startsWith(child.to + "/");
                          return (
                            <Link
                              key={child.to}
                              to={child.to}
                              onClick={() => setHoverOpen(null)}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                "hover:bg-surface-hover",
                                isChildActive
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              <child.icon className="h-4 w-4 shrink-0" />
                              <span>{t(child.labelKey)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Expanded sidebar: parent row + collapsible children
            return (
              <div key={item.to}>
                {/* Parent row */}
                <div
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors",
                    "hover:bg-surface-hover",
                    anyChildActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {/* Clicking icon/label navigates to parent route */}
                  <Link
                    to={item.to}
                    className="flex flex-1 items-center gap-3 px-3 py-2"
                  >
                    <div className="relative shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span>{t(item.labelKey)}</span>
                  </Link>
                  {/* Clicking chevron toggles expand/collapse */}
                  <button
                    type="button"
                    onClick={() => toggleNavItem(item.to)}
                    className="flex h-full items-center px-2 py-2 hover:text-foreground"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Children (indented) */}
                {isExpanded && (
                  <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
                    {item.children!.map((child) => {
                      const isChildActive =
                        pathname === child.to ||
                        pathname.startsWith(child.to + "/");
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            "hover:bg-surface-hover",
                            isChildActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{t(child.labelKey)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // --- Items WITHOUT children (original behavior) ---
          const link = (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-surface-hover",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
                !sidebarOpen && "justify-center px-0",
              )}
            >
              {/* Icon with ripple dot on top-right (collapsed only) */}
              <div className="relative shrink-0">
                <item.icon className="h-4 w-4" />
                {!sidebarOpen && isProjecting && (
                  <span className="absolute -right-1 -top-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </div>
              {sidebarOpen && <span>{t(item.labelKey)}</span>}
              {/* Right-side ripple dot (expanded only) */}
              {sidebarOpen && isProjecting && (
                <span className="relative ml-auto flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              )}
            </Link>
          );

          if (!sidebarOpen) {
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {activeServiceId && activeServiceData && (
        <div className="border-t border-border p-2">
          <Link
            to="/services/$serviceId"
            params={{ serviceId: String(activeServiceId) }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-surface-hover",
              !sidebarOpen && "justify-center px-0",
            )}
          >
            <ListChecks className="h-3.5 w-3.5 shrink-0 text-primary" />
            {sidebarOpen && (
              <span className="truncate text-muted-foreground">
                {activeServiceData.service.title}
              </span>
            )}
          </Link>
        </div>
      )}
    </aside>
  );
}
