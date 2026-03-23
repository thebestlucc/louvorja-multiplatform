import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, Upload, MoreVertical, Trash2, Download, Presentation as PresentationIcon, Search } from "lucide-react";
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { usePresentations, useCreatePresentation, useDeletePresentation, useImportSlja, useExportSlja } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import type { Presentation } from "../../lib/bindings";

export const Route = createFileRoute("/presentations/")({
  component: PresentationsIndex,
});

function PresentationsIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: presentations, isLoading } = usePresentations();
  const createMutation = useCreatePresentation();
  const deleteMutation = useDeletePresentation();
  const importMutation = useImportSlja();
  const exportMutation = useExportSlja();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = (presentations ?? []).filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync({
      title: t("presentations.untitled"),
      aspectRatio: "16:9",
    });
    navigate({ to: "/presentations/$presentationId", params: { presentationId: String(result.id) } });
  };

  const handleImport = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Presentations", extensions: ["slja", "pptx"] },
      ],
    });
    if (selected && !Array.isArray(selected)) {
      const result = await importMutation.mutateAsync(selected);
      navigate({ to: "/presentations/$presentationId", params: { presentationId: String(result.id) } });
    }
  };

  const handleExport = async (presentation: Presentation) => {
    const selected = await save({
      defaultPath: `${presentation.title}.slja`,
      filters: [{ name: "LouvorJA Presentation", extensions: ["slja"] }],
    });
    if (selected) {
      exportMutation.mutate({ presentationId: presentation.id, path: selected });
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={t("presentations.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label={t("presentations.searchPlaceholder")}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="mr-2 h-4 w-4" />
            {t("presentations.import")}
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("presentations.new")}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <PresentationIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-foreground">
              {searchQuery ? t("presentations.noResults") : t("presentations.empty")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? t("presentations.tryDifferentSearch")
                : t("presentations.emptyDescription")}
            </p>
          </div>
          {!searchQuery && (
            <Button size="sm" onClick={handleCreate} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              {t("presentations.new")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((presentation) => (
            <PresentationCard
              key={presentation.id}
              presentation={presentation}
              onExport={() => handleExport(presentation)}
              onDelete={() => handleDelete(presentation.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PresentationCard({
  presentation,
  onExport,
  onDelete,
}: {
  presentation: Presentation;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const updatedDate = new Date(presentation.updatedAt).toLocaleDateString();

  return (
    <Link
      to="/presentations/$presentationId"
      params={{ presentationId: String(presentation.id) }}
      className={cn(
        "group flex flex-col rounded-xl border border-border bg-surface transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
      )}
    >
      {/* Slide preview area */}
      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-gradient-to-br from-black/90 via-black/80 to-black/70">
        <div className="flex h-full items-center justify-center">
          <PresentationIcon className="h-10 w-10 text-white/15" />
        </div>
        {/* Aspect ratio badge */}
        <Badge
          variant="secondary"
          className="absolute top-2.5 right-2.5 bg-black/50 text-[10px] text-white/80 backdrop-blur-sm"
        >
          {presentation.aspectRatio}
        </Badge>
      </div>

      {/* Card footer */}
      <div className="flex items-start justify-between gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
            {presentation.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {updatedDate}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-surface-hover hover:text-foreground group-hover:opacity-100"
              onClick={(e) => e.preventDefault()}
              aria-label={t("actions.more")}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport(); }}>
              <Download className="mr-2 h-4 w-4" />
              {t("presentations.export")}
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
    </Link>
  );
}
