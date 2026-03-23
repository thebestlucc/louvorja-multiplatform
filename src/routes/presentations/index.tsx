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

/** Deterministic gradient from presentation id for visual variety */
function idGradient(id: number): string {
  const hues = [220, 260, 310, 180, 340, 30, 150, 200];
  const hue = hues[id % hues.length];
  return `linear-gradient(135deg, hsl(${hue} 40% 18%) 0%, hsl(${(hue + 40) % 360} 30% 12%) 100%)`;
}

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
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted">
            <PresentationIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              {searchQuery ? t("presentations.noResults") : t("presentations.empty")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? t("presentations.tryDifferentSearch")
                : t("presentations.emptyDescription")}
            </p>
          </div>
          {!searchQuery && (
            <Button onClick={handleCreate} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              {t("presentations.new")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
  const isWide = presentation.aspectRatio === "16:9";

  return (
    <Link
      to="/presentations/$presentationId"
      params={{ presentationId: String(presentation.id) }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
      )}
    >
      {/* Slide preview area - 80% of the card visually */}
      <div
        className={cn(
          "relative overflow-hidden",
          isWide ? "aspect-video" : "aspect-[4/3]",
        )}
        style={{ background: idGradient(presentation.id) }}
      >
        {/* Decorative slide lines to suggest content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
          <div className="h-2.5 w-3/5 rounded-sm bg-white/8" />
          <div className="h-1.5 w-2/5 rounded-sm bg-white/5" />
          <div className="mt-2 h-1 w-4/5 rounded-sm bg-white/4" />
          <div className="h-1 w-3/5 rounded-sm bg-white/4" />
          <div className="h-1 w-2/5 rounded-sm bg-white/3" />
        </div>

        {/* Aspect ratio badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 bg-black/50 text-[9px] text-white/70 backdrop-blur-sm border-0 h-4 px-1"
        >
          {presentation.aspectRatio}
        </Badge>

        {/* Three-dot menu on hover */}
        <div className="absolute top-1.5 left-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md bg-black/50 p-1 text-white/70 backdrop-blur-sm transition-colors duration-100 hover:bg-black/70 hover:text-white"
                onClick={(e) => e.preventDefault()}
                aria-label={t("actions.more")}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
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
      </div>

      {/* Card footer - compact */}
      <div className="px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
          {presentation.title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {updatedDate}
        </p>
      </div>
    </Link>
  );
}
