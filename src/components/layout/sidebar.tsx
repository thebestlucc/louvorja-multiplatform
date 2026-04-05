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
import { useLiturgy } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

const PLAYING_NOW_ROUTE = "/playing-now";

// Optional search params a child can require to be considered active.
// If set, the child is active only when ALL search params match.
// If not set, the child is active when the path matches and NO sibling's search params match.
type NavChild = {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  search?: Record<string, string>;
};
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
      { to: "/collections", icon: Video, labelKey: "nav.onlineVideos", search: { tab: "online-videos" } },
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

/** Returns whether a child nav item is active given the current pathname + search params.
 *  - Children WITH search: active when path matches AND all search params match.
 *  - Children WITHOUT search: active when path matches AND no sibling's search params match. */
function isChildActive(
  pathname: string,
  searchParams: Record<string, string | undefined>,
  child: NavChild,
  siblings: NavChild[],
): boolean {
  const pathMatch = pathname === child.to || pathname.startsWith(child.to + "/");
  if (!pathMatch) return false;

  if (child.search) {
    return Object.entries(child.search).every(([k, v]) => searchParams[k] === v);
  }

  // No search requirement — active only when no sibling with search params matches
  return !siblings.some(
    (s) =>
      s !== child &&
      s.search &&
      (pathname === s.to || pathname.startsWith(s.to + "/")) &&
      Object.entries(s.search).every(([k, v]) => searchParams[k] === v),
  );
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, expandedNavItems, toggleNavItem, setNavItemExpanded } =
    useUIStore();
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const { data: activeLiturgyData } = useLiturgy(activeLiturgyId ?? 0);
  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const isProjectingAnything = currentProjectionType !== null;
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const searchParams = location.search as Record<string, string | undefined>;

  const isOnActiveServiceRoute =
    activeLiturgyId !== null &&
    (pathname === `/services/${activeLiturgyId}` ||
      pathname.startsWith(`/services/${activeLiturgyId}/`));

  // Hover popover state for collapsed sidebar
  const [hoverOpen, setHoverOpen] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (key: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoverOpen(key), 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoverOpen(null), 150);
  };

  // Auto-expand parent when current route matches any child
  useEffect(() => {
    for (const item of navItems) {
      if (!item.children) continue;
      const anyChildActive = item.children.some((child) =>
        isChildActive(pathname, searchParams, child, item.children!),
      );
      if (anyChildActive && !expandedNavItems[item.to]) {
        setNavItemExpanded(item.to, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, JSON.stringify(searchParams), setNavItemExpanded]);

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "flex flex-col border-r border-border bg-surface transition-all duration-200",
        sidebarOpen ? "w-60" : "w-14",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {t("app.name")}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("h-8 w-8 shrink-0", !sidebarOpen && "mx-auto")}
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
            const anyChildIsActive = item.children!.some((child) =>
              isChildActive(pathname, searchParams, child, item.children!),
            );

            // Collapsed sidebar: icon with hover popover
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
                      anyChildIsActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
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
                          const childActive = isChildActive(pathname, searchParams, child, item.children!);
                          return (
                            <Link
                              key={child.labelKey}
                              to={child.to}
                              search={child.search ?? {}}
                              onClick={() => setHoverOpen(null)}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                "hover:bg-surface-hover",
                                childActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
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
                <div
                  className={cn(
                    "flex items-center rounded-r-md text-sm transition-colors hover:bg-surface-hover hover:text-foreground",
                    anyChildIsActive
                      ? "border-l-2 border-primary bg-accent/60 text-foreground font-medium"
                      : "border-l-2 border-transparent text-muted-foreground",
                  )}
                >
                  <Link
                    to={item.to}
                    className="flex flex-1 items-center gap-3 pl-2.5 pr-3 py-2"
                  >
                    <div className="relative shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span>{t(item.labelKey)}</span>
                  </Link>
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

                {isExpanded && (
                  <div className="mt-0.5 flex flex-col gap-0.5 ml-3.25 border-l border-border pl-3">
                    {item.children!.map((child) => {
                      const childActive = isChildActive(pathname, searchParams, child, item.children!);
                      return (
                        <Link
                          key={child.labelKey}
                          to={child.to}
                          search={child.search ?? {}}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                            "hover:bg-surface-hover hover:text-foreground",
                            childActive ? "text-primary font-medium bg-accent/40" : "text-muted-foreground",
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

          // --- Items WITHOUT children ---
          const link = (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-r-md py-2 text-sm transition-colors",
                "hover:bg-surface-hover hover:text-foreground",
                isActive
                  ? "border-l-2 border-primary bg-accent/60 text-foreground font-medium pl-2.5 pr-3"
                  : "border-l-2 border-transparent text-muted-foreground pl-2.5 pr-3",
                !sidebarOpen && "justify-center pl-0 pr-0 border-l-0 rounded-md",
              )}
            >
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

      {activeLiturgyId && activeLiturgyData && !isOnActiveServiceRoute && (
        <div className="border-t border-border px-2 py-2">
          <Link
            to="/services/$serviceId"
            params={{ serviceId: String(activeLiturgyId) }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "bg-primary/10 text-primary hover:bg-primary/20",
              !sidebarOpen && "justify-center px-0",
            )}
          >
            <ListChecks className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && (
              <span className="truncate">{activeLiturgyData.service.title}</span>
            )}
          </Link>
        </div>
      )}
    </aside>
  );
}
