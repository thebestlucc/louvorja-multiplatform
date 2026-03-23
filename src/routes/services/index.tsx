import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarPlus, MoreVertical, Trash2, Copy, ListChecks, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { useServices, useCreateService, useDeleteService, useDuplicateService } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { CategoryBadge } from "../../components/services/category-picker";
import { cn } from "../../lib/utils";
import type { Service } from "../../types/service";

export const Route = createFileRoute("/services/")({
  component: ServicesIndex,
});

function formatShortDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("default", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ServicesIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: services, isLoading } = useServices();
  const createMutation = useCreateService();
  const deleteMutation = useDeleteService();
  const duplicateMutation = useDuplicateService();
  const [searchQuery, setSearchQuery] = useState("");

  // Sort by date descending (most recent first), then filter
  const sorted = useMemo(() => {
    const all = services ?? [];
    return [...all].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [services]);

  const filtered = sorted.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync({
      title: t("services.untitled"),
      date: new Date().toISOString().split("T")[0],
      notes: null,
    });
    navigate({ to: "/services/$serviceId", params: { serviceId: String(result.id) } });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate(id);
  };

  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.services")}</h1>
            {(services ?? []).length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {(services ?? []).length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t("dashboard.descriptions.services")}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button onClick={handleCreate} className="shadow-sm">
          <CalendarPlus className="mr-2 h-4 w-4" />
          {t("services.new")}
        </Button>
        <div className="relative ml-auto w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("services.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border/60 bg-surface/50 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
            <ListChecks className="h-8 w-8 text-primary/30" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{t("services.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchQuery ? t("services.searchPlaceholder") : t("dashboard.descriptions.services")}
            </p>
          </div>
          {!searchQuery && (
            <Button onClick={handleCreate} className="mt-2 shadow-sm">
              <CalendarPlus className="mr-2 h-4 w-4" />
              {t("services.new")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onDuplicate={() => handleDuplicate(service.id)}
              onDelete={() => handleDelete(service.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  onDuplicate,
  onDelete,
}: {
  service: Service;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const shortDate = formatShortDate(service.date);
  const itemCount = (service as Service & { itemCount?: number }).itemCount ?? 0;

  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: String(service.id) }}
      className={cn(
        "group relative flex cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-150",
        "hover:border-primary/50 hover:shadow-md",
      )}
    >
      {/* Left accent stripe */}
      <div className="w-1 shrink-0 bg-primary/50 group-hover:bg-primary/70" />

      <div className="flex flex-1 flex-col p-4">
        {/* Top row: date + category */}
        <div className="mb-2 flex items-center gap-2">
          {shortDate && (
            <span className="font-mono text-[11px] tracking-tight text-muted-foreground">
              {shortDate}
            </span>
          )}
          <CategoryBadge serviceId={service.id} />
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug tracking-tight text-foreground">
          {service.title}
        </h3>

        {/* Notes preview (1 line) */}
        {service.notes && (
          <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground/70 italic">
            {service.notes}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3">
          {itemCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[11px] tabular-nums text-muted-foreground/60">
                {t("services.itemCount", { count: itemCount })}
              </span>
            </div>
          ) : (
            <span />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-surface-hover hover:text-foreground group-hover:opacity-100"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                <Copy className="mr-2 h-4 w-4" />
                {t("services.duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Link>
  );
}
