import { Link, Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, CaseSensitive, Clock3, LayoutGrid, Shuffle, Timer } from "lucide-react";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/utilities")({
  component: UtilitiesLayout,
});

const utilityNav = [
  { to: "/utilities", icon: LayoutGrid, key: "utilities.nav.overview" },
  { to: "/utilities/timer", icon: Timer, key: "utilities.nav.timer" },
  { to: "/utilities/clock", icon: Clock3, key: "utilities.nav.clock" },
  { to: "/utilities/schedules", icon: CalendarDays, key: "utilities.nav.schedules" },
  { to: "/utilities/lottery", icon: Shuffle, key: "utilities.nav.lottery" },
  { to: "/utilities/text", icon: CaseSensitive, key: "utilities.nav.text" },
] as const;

function UtilitiesLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("utilities.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("utilities.subtitle")}</p>
      </div>

      <nav className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {utilityNav.map((item) => {
          const isActive = Boolean(matchRoute({ to: item.to }));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
