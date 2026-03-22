import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Music,
  FolderOpen,
  BookOpen,
  Presentation,
  ListChecks,
  MonitorPlay,
  ArrowRight,
} from "lucide-react";
import { usePresentationStore } from "../stores/presentation-store";
import { useService } from "../lib/queries";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "dashboard.greetingDawn";
  if (hour < 12) return "dashboard.greetingMorning";
  if (hour < 18) return "dashboard.greetingAfternoon";
  return "dashboard.greetingEvening";
}

function Dashboard() {
  const { t } = useTranslation();
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);
  const { data: activeServiceData } = useService(activeServiceId ?? 0);

  return (
    <div className="mx-auto max-w-3xl dashboard-fade-in">
      {/* Greeting — warm, not corporate */}
      <div className="pb-8 pt-4">
        <p className="text-lg text-muted-foreground">{t(getGreetingKey())}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("dashboard.whatToDo")}
        </h1>
      </div>

      {/* Active service — the most time-sensitive thing */}
      {activeServiceId && activeServiceData && (
        <Link
          to="/services/$serviceId"
          params={{ serviceId: String(activeServiceId) }}
          className="group mb-6 block"
        >
          <div className="flex items-center gap-4 rounded-lg bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-90">
            <MonitorPlay className="h-5 w-5 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-widest opacity-70">
                {t("dashboard.activeService")}
              </p>
              <p className="truncate text-sm font-medium">
                {activeServiceData.service.title}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      )}

      {/* Main navigation — Services & Hymnal get prominence */}
      <div className="space-y-2">
        <NavRow
          to="/services"
          icon={ListChecks}
          label={t("nav.services")}
          hint={t("dashboard.hints.services")}
        />
        <NavRow
          to="/hymnal"
          icon={Music}
          label={t("nav.hymnal")}
          hint={t("dashboard.hints.hymnal")}
        />

        <div className="h-px bg-border/60 my-1" />

        <NavRow
          to="/bible"
          icon={BookOpen}
          label={t("nav.bible")}
          hint={t("dashboard.hints.bible")}
        />
        <NavRow
          to="/presentations"
          icon={Presentation}
          label={t("nav.presentations")}
          hint={t("dashboard.hints.presentations")}
        />
        <NavRow
          to="/collections"
          icon={FolderOpen}
          label={t("nav.collections")}
          hint={t("dashboard.hints.collections")}
        />
      </div>
    </div>
  );
}

function NavRow({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link to={to}>
      <div
        className={cn(
          "group flex items-center gap-4 rounded-lg px-4 py-3.5",
          "transition-colors duration-150",
          "hover:bg-surface-hover",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="ml-3 text-xs text-muted-foreground hidden sm:inline">{hint}</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-border transition-all group-hover:text-muted-foreground group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
