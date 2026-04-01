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
  Zap,
} from "lucide-react";
import { usePresentationStore } from "../stores/presentation-store";
import { useLiturgy } from "../lib/queries";
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

const NAV_ITEMS = [
  { to: "/services", icon: ListChecks, labelKey: "nav.services", hintKey: "dashboard.hints.services" },
  { to: "/hymnal", icon: Music, labelKey: "nav.hymnal", hintKey: "dashboard.hints.hymnal" },
  { to: "/bible", icon: BookOpen, labelKey: "nav.bible", hintKey: "dashboard.hints.bible" },
  { to: "/presentations", icon: Presentation, labelKey: "nav.presentations", hintKey: "dashboard.hints.presentations" },
  { to: "/collections", icon: FolderOpen, labelKey: "nav.collections", hintKey: "dashboard.hints.collections" },
] as const;

function Dashboard() {
  const { t } = useTranslation();
  const activeLiturgyId = usePresentationStore((s) => s.activeLiturgyId);
  const { data: activeLiturgyData } = useLiturgy(activeLiturgyId ?? 0);

  const shortcuts = [
    { keys: "Ctrl+K", label: t("dashboard.shortcuts.search") },
    { keys: "F5", label: t("dashboard.shortcuts.projector") },
    { keys: "Ctrl+/", label: t("dashboard.shortcuts.help") },
  ];

  return (
    <div className="mx-auto max-w-3xl dashboard-fade-in">
      {/* Greeting */}
      <div className="pb-6 pt-4">
        <p className="text-lg text-muted-foreground">{t(getGreetingKey())}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("dashboard.whatToDo")}
        </h1>
      </div>

      {/* Active liturgy */}
      {activeLiturgyId && activeLiturgyData && (
        <Link
          to="/services/$serviceId"
          params={{ serviceId: String(activeLiturgyId) }}
          className="group mb-5 block"
        >
          <div className="flex items-center gap-4 rounded-lg bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-90">
            <MonitorPlay className="h-5 w-5 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-widest opacity-70">
                {t("dashboard.activeService")}
              </p>
              <p className="truncate text-sm font-medium">
                {activeLiturgyData.service.title}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3">
        {NAV_ITEMS.map((item, i) => {
          const isLast = i === NAV_ITEMS.length - 1 && NAV_ITEMS.length % 2 !== 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(isLast && "col-span-2 sm:col-span-1")}
            >
              <div
                className={cn(
                  "group flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-4",
                  "transition-all duration-150",
                  "hover:shadow-sm hover:border-muted-foreground/25",
                )}
              >
                <item.icon className="mb-4 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t(item.labelKey)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(item.hintKey)}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Shortcuts */}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <Zap className="h-3 w-3" />
          {t("dashboard.shortcuts.title")}
        </span>
        {shortcuts.map((s) => (
          <span key={s.keys} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {s.keys}
            </kbd>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
