import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, Upload, MoreVertical, Trash2, Download, Presentation as PresentationIcon } from "lucide-react";
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { usePresentations, useCreatePresentation, useDeletePresentation, useImportSlja, useExportSlja } from "../../lib/queries";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";
import type { Presentation } from "../../types/presentation";

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
    if (selected) {
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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("nav.presentations")}</h1>
        <div className="flex gap-2">
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

      {/* Search */}
      <Input
        placeholder={t("presentations.searchPlaceholder")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <PresentationIcon className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t("presentations.empty")}</p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("presentations.new")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  const updatedDate = new Date(presentation.updated_at).toLocaleDateString();

  return (
    <Link
      to="/presentations/$presentationId"
      params={{ presentationId: String(presentation.id) }}
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-surface p-4 transition-colors",
        "hover:border-primary/50 hover:bg-surface-hover",
      )}
    >
      {/* Thumbnail placeholder */}
      <div className="mb-3 aspect-video rounded-md bg-black flex items-center justify-center">
        <PresentationIcon className="h-8 w-8 text-white/20" />
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{presentation.title}</h3>
          <p className="text-xs text-muted-foreground">
            {presentation.aspect_ratio} &middot; {updatedDate}
          </p>
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
