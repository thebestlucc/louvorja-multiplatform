import { Link, Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CaseSensitive, Clock3, Library, Shuffle, Timer, Type } from "lucide-react";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/utilities")({
  component: UtilitiesLayout,
});

const utilityNav = [
  { to: "/utilities/timer", icon: Timer, key: "utilities.nav.timer" },
  { to: "/utilities/clock", icon: Clock3, key: "utilities.nav.clock" },
  { to: "/utilities/media-library", icon: Library, key: "utilities.nav.mediaLibrary" },
  { to: "/utilities/lottery", icon: Shuffle, key: "utilities.nav.lottery" },
  { to: "/utilities/text", icon: CaseSensitive, key: "utilities.nav.text" },
  { to: "/utilities/interactive-text", icon: Type, key: "utilities.nav.interactiveText" },
] as const;

function UtilitiesLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <div className="flex h-full overflow-hidden">
      <nav className="w-52 flex-shrink-0 border-r border-border bg-surface p-3">
        <h1 className="mb-3 px-3 text-lg font-semibold">{t("nav.utilities")}</h1>
        <ul className="space-y-1">
          {utilityNav.map((item) => {
            const isActive = Boolean(matchRoute({ to: item.to }));
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
