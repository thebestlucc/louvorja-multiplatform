import { Link, useMatchRoute } from "@tanstack/react-router";
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

const navItems = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/hymnal", icon: Music, labelKey: "nav.hymnal" },
  { to: "/collections", icon: FolderOpen, labelKey: "nav.collections" },
  { to: "/bible", icon: BookOpen, labelKey: "nav.bible" },
  { to: "/presentations", icon: Presentation, labelKey: "nav.presentations" },
  { to: "/services", icon: ListChecks, labelKey: "nav.services" },
  { to: "/playing-now", icon: MonitorPlay, labelKey: "nav.playingNow" },
  { to: "/utilities", icon: Wrench, labelKey: "nav.utilities" },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
  { to: "/help", icon: CircleHelp, labelKey: "nav.help" },
] as const;

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);
  const { data: activeServiceData } = useService(activeServiceId ?? 0);
  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const isProjectingAnything = currentProjectionType !== null;
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

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
          const isActive = matchRoute({ to: item.to, fuzzy: item.to !== "/" });
          const isProjecting = item.to === PLAYING_NOW_ROUTE && isProjectingAnything;
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
