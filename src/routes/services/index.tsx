import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, MoreVertical, Trash2, Copy, ListChecks, Calendar } from "lucide-react";
import { useState } from "react";
import { useServices, useCreateService, useDeleteService, useDuplicateService } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";
import type { Service } from "../../types/service";

export const Route = createFileRoute("/services/")({
  component: ServicesIndex,
});

function ServicesIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: services, isLoading } = useServices();
  const createMutation = useCreateService();
  const deleteMutation = useDeleteService();
  const duplicateMutation = useDuplicateService();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = (services ?? []).filter((s) =>
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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("nav.services")}</h1>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("services.new")}
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder={t("services.searchPlaceholder")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <ListChecks className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t("services.empty")}</p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("services.new")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  const displayDate = service.date
    ? new Date(service.date + "T00:00:00").toLocaleDateString()
    : null;

  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: String(service.id) }}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all",
        "hover:border-primary/50 hover:bg-surface-hover hover:shadow-md",
      )}
    >
      <div className="h-1 bg-primary/40" />
      <div className="p-4">
      <div className="mb-3 flex h-14 items-center justify-center rounded-md bg-primary/5">
        <ListChecks className="h-7 w-7 text-primary/25 transition-colors group-hover:text-primary/50" />
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{service.title}</h3>
          {displayDate && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {displayDate}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
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
