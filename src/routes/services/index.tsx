import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  CalendarPlus, MoreVertical, Trash2, Copy, ListChecks, Search,
  Calendar, Star, LayoutGrid, List, ListFilter, ChevronDown, Music, Sun,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback, type MouseEvent } from "react";
import { useLiturgies, useCreateLiturgy, useDeleteLiturgy, useDuplicateLiturgy } from "../../lib/queries";
import { useRouteTour } from "../../hooks/use-route-tour";
import { SpotlightTour } from "../../components/tour/spotlight-tour";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { useCategoryStore } from "../../components/services/category-picker";
import { cn } from "../../lib/utils";
import { catcher } from "../../lib/catcher";
import { getPreference, setPreference } from "../../lib/store";
import type { Liturgy } from "../../types/liturgy";

// ─── helpers ─────────────────────────────────────────────

function formatShortDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return new Intl.DateTimeFormat("default", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr + "T00:00:00"));
}

type PillColor = { bg: string; text: string; border: string; dot: string };

function getCategoryColor(category: string | null): PillColor {
  const lower = (category ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("louvor"))
    return { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", dot: "bg-green-400" };
  if (lower.includes("prega"))
    return { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-400" };
  if (lower.includes("evangelis"))
    return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" };
  if (lower.includes("joven"))
    return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-400" };
  if (lower.includes("especial"))
    return { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20", dot: "bg-sky-400" };
  return { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", dot: "bg-primary" };
}

// ─── favorites store ──────────────────────────────────────

function useLiturgyFavorites() {
  const [favorites, setFavoritesState] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [data] = await catcher(getPreference<number[]>("service_favorites", []));
      if (!cancelled && data !== null) setFavoritesState(data);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleFavorite = useCallback((serviceId: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoritesState((prev) => {
      if (prev.includes(serviceId)) {
        const next = prev.filter((id) => id !== serviceId);
        void catcher(setPreference("service_favorites", next));
        return next;
      }
      if (prev.length >= 7) {
        return prev; // caller checks isFull and shows toast
      }
      const next = [...prev, serviceId];
      void catcher(setPreference("service_favorites", next));
      return next;
    });
  }, []);

  const isFull = favorites.length >= 7;

  const isFavorite = useCallback((serviceId: number) => favorites.includes(serviceId), [favorites]);

  return { favorites, toggleFavorite, isFavorite, isFull };
}

// ─── view preference ──────────────────────────────────────

function useViewPreference() {
  const [view, setViewState] = useState<"grid" | "list">("grid");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [data] = await catcher(getPreference<string>("service_view_pref", "grid"));
      if (!cancelled && (data === "grid" || data === "list")) setViewState(data);
    })();
    return () => { cancelled = true; };
  }, []);

  const setView = useCallback((v: "grid" | "list") => {
    setViewState(v);
    void catcher(setPreference("service_view_pref", v));
  }, []);

  return { view, setView };
}

// ─── route ────────────────────────────────────────────────

export const Route = createFileRoute("/services/")({
  component: LiturgiesIndex,
});

function LiturgiesIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: services, isLoading } = useLiturgies();
  const createMutation = useCreateLiturgy();
  const { showTour, steps, handleComplete, handleSkip } = useRouteTour("/services");
  const deleteMutation = useDeleteLiturgy();
  const duplicateMutation = useDuplicateLiturgy();
  const [searchQuery, setSearchQuery] = useState("");
  const { toggleFavorite, isFavorite, isFull } = useLiturgyFavorites();
  const { view, setView } = useViewPreference();
  const { getCategory, loaded: categoriesLoaded } = useCategoryStore();

  const todayWeekDay = new Date().getDay();
  const todayLiturgy = useMemo(
    () => (services ?? []).find((s) => s.weekDay === todayWeekDay) ?? null,
    [services, todayWeekDay],
  );

  const sorted = useMemo(() => {
    const all = services ?? [];
    return [...all].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [services]);

  const filtered = useMemo(
    () => sorted.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [sorted, searchQuery],
  );

  const favServices = useMemo(
    () => filtered.filter((s) => isFavorite(s.id)).slice(0, 7),
    [filtered, isFavorite],
  );

  const otherServices = useMemo(
    () => filtered.filter((s) => !isFavorite(s.id)),
    [filtered, isFavorite],
  );

  const total = (services ?? []).length;

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync({
      title: t("services.untitled"),
      date: new Date().toISOString().split("T")[0],
      notes: null,
    });
    navigate({ to: "/services/$serviceId", params: { serviceId: String(result.id) } });
  };

  const handleDelete = (id: number) => deleteMutation.mutate(id);
  const handleDuplicate = (id: number) => duplicateMutation.mutate(id);

  return (
    <div className="flex flex-col gap-4 p-1" data-tour="services-list">
      {/* Header: title left, "Nova Liturgia" right */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{t("nav.services")}</h1>
            {total > 0 && (
              <span className="rounded-full bg-white/9 px-2 py-0.5 text-[11px] text-muted-foreground">
                {total}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("dashboard.descriptions.services")}</p>
        </div>
        <Button onClick={handleCreate} size="sm" className="flex-shrink-0" data-tour="new-service">
          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
          {t("services.new")}
        </Button>
      </div>

      {/* Sub-toolbar: search | divider | sort | grid/list toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex flex-1 items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            className="h-7.5 w-full rounded-md border border-border bg-white/4 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder={t("services.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="h-4.5 w-px flex-shrink-0 bg-border" />
        <button className="flex h-7.5 flex-shrink-0 items-center gap-1.5 rounded-md border border-border bg-white/5 px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ListFilter className="h-3 w-3" />
          {t("services.sortByDate")}
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="flex flex-shrink-0 overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "flex size-7.5 items-center justify-center transition-colors",
              view === "grid"
                ? "bg-white/12 text-foreground"
                : "bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex size-7.5 items-center justify-center border-l border-border transition-colors",
              view === "list"
                ? "bg-white/12 text-foreground"
                : "bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-35 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          <TodayLiturgySection
            todayLiturgy={todayLiturgy}
            view={view}
            isFavorite={todayLiturgy ? isFavorite(todayLiturgy.id) : false}
            isFull={isFull}
            category={todayLiturgy && categoriesLoaded ? getCategory(todayLiturgy.id) : null}
            onToggleFavorite={toggleFavorite}
            onDuplicate={todayLiturgy ? () => handleDuplicate(todayLiturgy.id) : () => {}}
            onDelete={todayLiturgy ? () => handleDelete(todayLiturgy.id) : () => {}}
            onCreate={handleCreate}
          />

          {filtered.length === 0 ? (
            <EmptyState hasSearch={!!searchQuery} onCreate={handleCreate} />
          ) : (
            <>
              {favServices.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <SectionHeader
                    icon={<Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    label={t("services.favorites").toUpperCase()}
                    count={`${favServices.length} ${t("services.ofTotal")} 7`}
                  />
                  <div className={view === "grid" ? "grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]" : "flex flex-col gap-0.5"}>
                    {favServices.map((s) => (
                      <LiturgyCard
                        key={s.id}
                        service={s}
                        view={view}
                        isFavorite={true}
                        isFull={isFull}
                        category={categoriesLoaded ? getCategory(s.id) : null}
                        onToggleFavorite={toggleFavorite}
                        onDuplicate={() => handleDuplicate(s.id)}
                        onDelete={() => handleDelete(s.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {otherServices.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <SectionHeader
                    icon={<Calendar className="h-3 w-3 text-muted-foreground" />}
                    label={t("services.otherServices").toUpperCase()}
                    count={String(otherServices.length)}
                  />
                  <div className={view === "grid" ? "grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]" : "flex flex-col gap-0.5"}>
                    {otherServices.map((s) => (
                      <LiturgyCard
                        key={s.id}
                        service={s}
                        view={view}
                        isFavorite={false}
                        isFull={isFull}
                        category={categoriesLoaded ? getCategory(s.id) : null}
                        onToggleFavorite={toggleFavorite}
                        onDuplicate={() => handleDuplicate(s.id)}
                        onDelete={() => handleDelete(s.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {showTour && steps.length > 0 && (
        <SpotlightTour steps={steps} onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </div>
  );
}

// ─── section header ───────────────────────────────────────

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border pb-2">
      {icon}
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/80">{label}</span>
      <span className="text-[10.5px] text-muted-foreground/45">{count}</span>
    </div>
  );
}

// ─── liturgy card ─────────────────────────────────────────

interface LiturgyCardProps {
  service: Liturgy;
  view: "grid" | "list";
  isFavorite: boolean;
  isFull: boolean;
  category: string | null;
  onToggleFavorite: (id: number, e: MouseEvent) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isToday?: boolean;
}

function LiturgyCard({ service, view, isFavorite, isFull, category, onToggleFavorite, onDuplicate, onDelete, isToday }: LiturgyCardProps) {
  const { t } = useTranslation();
  const shortDate = formatShortDate(service.date);
  const hymnCount = service.hymnCount ?? 0;
  const itemCount = service.itemCount ?? 0;
  const pillColor = getCategoryColor(category);

  const weekDayName = service.weekDay != null
    ? new Intl.DateTimeFormat("default", { weekday: "long" }).format(
        new Date(2024, 0, service.weekDay === 0 ? 7 : service.weekDay) // Mon=1…Sun=0→7
      )
    : null;

  const datePill = shortDate ? (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-white/6 px-1.5 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
      <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
      {shortDate}
    </span>
  ) : weekDayName ? (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-white/6 px-1.5 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
      <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
      {t("services.everyWeekDay", { day: weekDayName })}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-border/50 px-1.5 py-0.5 text-[11px] text-muted-foreground/40 whitespace-nowrap">
      <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
      {t("services.noDate")}
    </span>
  );

  const starBtn = (
    <button
      onClick={(e) => {
        if (!isFavorite && isFull) {
          e.preventDefault();
          e.stopPropagation();
          toast.error(t("services.favoritesLimitReached"));
          return;
        }
        onToggleFavorite(service.id, e);
      }}
      className={cn("flex-shrink-0 p-0.5 transition-opacity", isFavorite ? "opacity-100" : isFull ? "opacity-20 cursor-not-allowed" : "opacity-25 hover:opacity-65")}
    >
      <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-amber-400 text-amber-400" : "text-foreground")} />
    </button>
  );

  const menuBtn = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex-shrink-0 p-0.5 opacity-25 transition-opacity hover:opacity-60" onClick={(e) => e.preventDefault()}>
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Copy className="mr-2 h-4 w-4" />
          {t("services.duplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t("actions.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const categoryPill = category ? (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", pillColor.bg, pillColor.text, pillColor.border)}>
      <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full opacity-75", pillColor.dot)} />
      {category}
    </span>
  ) : null;

  const footerStats = (
    <>
      <span className="flex items-center gap-1">
        <Music className="h-3 w-3" />
        {t("services.hymnCount", { count: hymnCount })}
      </span>
      <span className="flex items-center gap-1">
        <ListChecks className="h-3 w-3" />
        {t("services.itemCount", { count: itemCount })}
      </span>
    </>
  );

  if (view === "list") {
    return (
      <Link
        to="/services/$serviceId"
        params={{ serviceId: String(service.id) }}
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2",
          "transition-colors hover:bg-card/70",
          isFavorite && "border-primary/15 bg-primary/5 hover:bg-primary/8",
          isToday && "border-primary/25 bg-gradient-to-r from-primary/8 to-transparent hover:from-primary/12",
        )}
      >
        <div className="w-30 flex-shrink-0">{datePill}</div>
        {starBtn}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{service.title}</span>
        {categoryPill && <div className="flex-shrink-0">{categoryPill}</div>}
        <div className="ml-auto flex flex-shrink-0 items-center gap-2.5 border-l border-border pl-2.5 text-[11px] text-muted-foreground">
          {footerStats}
        </div>
        {menuBtn}
      </Link>
    );
  }

  // Grid card
  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: String(service.id) }}
      className={cn(
        "group flex min-h-35 min-w-0 cursor-pointer flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:bg-accent/40 hover:shadow-md",
        isFavorite && "border-primary/15 bg-primary/5 hover:bg-primary/8",
        isToday && "relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm hover:shadow-md hover:from-primary/14",
      )}
    >
      {isToday && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />
      )}
      {/* Top: date + actions */}
      <div className="flex items-start justify-between gap-1.5">
        {datePill}
        <div className="flex items-center gap-0.5">
          {starBtn}
          {menuBtn}
        </div>
      </div>

      {/* Body: title + category — flex-1 pushes footer to bottom */}
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-[13.5px] font-medium leading-snug text-foreground transition-colors duration-200 group-hover:text-foreground/90">{service.title}</span>
        {categoryPill && <div className="flex flex-wrap gap-1">{categoryPill}</div>}
      </div>

      {/* Footer: item count */}
      <div className="flex items-center gap-2.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
        {footerStats}
      </div>
    </Link>
  );
}

// ─── today's liturgy section ─────────────────────────────

interface TodayLiturgySection extends Omit<LiturgyCardProps, "service"> {
  todayLiturgy: Liturgy | null;
  onCreate: () => void;
}

function TodayLiturgySection({ todayLiturgy, view, isFavorite, isFull, category, onToggleFavorite, onDuplicate, onDelete, onCreate }: TodayLiturgySection) {
  const { t } = useTranslation();
  const todayName = new Intl.DateTimeFormat("default", { weekday: "long" }).format(new Date());

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 border-b border-primary/20 pb-2">
        <Sun className="h-3 w-3 text-primary" />
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-primary/90">
          {t("services.todayLiturgy")}
        </span>
        <span className="text-[10.5px] text-muted-foreground">{todayName}</span>
      </div>
      {todayLiturgy ? (
        <div className={view === "grid" ? "grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]" : "flex flex-col gap-0.5"}>
          <LiturgyCard
            service={todayLiturgy}
            view={view}
            isFavorite={isFavorite}
            isFull={isFull}
            category={category}
            onToggleFavorite={onToggleFavorite}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            isToday={true}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3">
          <Sun className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <p className="flex-1 text-sm text-muted-foreground">{t("services.todayLiturgyEmpty")}</p>
          <button
            onClick={onCreate}
            className="flex-shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            {t("services.new")}
          </button>
        </div>
      )}
    </section>
  );
}

// ─── empty state ──────────────────────────────────────────

function EmptyState({ hasSearch, onCreate }: { hasSearch: boolean; onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/50 py-14">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
        <ListChecks className="h-7 w-7 text-primary/30" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{t("services.empty")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasSearch ? t("services.searchPlaceholder") : t("dashboard.descriptions.services")}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} size="sm" className="mt-1">
          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
          {t("services.new")}
        </Button>
      )}
    </div>
  );
}
