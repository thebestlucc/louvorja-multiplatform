import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
} from "../../lib/queries";
import { CoverImage } from "../../components/media/cover-image";

export const Route = createFileRoute("/collections/")({
  component: CollectionsIndex,
});

function CollectionsIndex() {
  const { t } = useTranslation();
  const { data, isLoading } = useCollections();
  const createMutation = useCreateCollection();
  const deleteMutation = useDeleteCollection();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return data ?? [];
    return (data ?? []).filter((entry) => {
      return (
        entry.name.toLowerCase().includes(value) ||
        (entry.description ?? "").toLowerCase().includes(value)
      );
    });
  }, [data, search]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createMutation.mutateAsync({
        name: trimmed,
        description: description.trim() || null,
        coverPath: null,
      });
      setName("");
      setDescription("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("collections.saveFailed", { error: message }));
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.collections")}</h1>
          <p className="text-sm text-muted-foreground">{t("collections.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">{t("collections.createTitle")}</CardTitle>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("collections.namePlaceholder")}
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("collections.descriptionPlaceholder")}
              rows={2}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              {t("collections.create")}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("collections.searchPlaceholder")}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10">
          <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("collections.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((collection) => {
            const cover = collection.cover_path ?? collection.auto_cover_path;
            return (
              <Card key={collection.id} className="transition-colors hover:bg-surface-hover">
                <CardHeader className="flex flex-row items-start gap-3">
                  <Link
                    to="/collections/$collectionId"
                    params={{ collectionId: String(collection.id) }}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <CoverImage path={cover} title={collection.name} className="h-14 w-14" />
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{collection.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {collection.description || t("collections.noDescription")}
                      </CardDescription>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      try {
                        await deleteMutation.mutateAsync(collection.id);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        toast.error(t("collections.deleteFailed", { error: message }));
                      }
                    }}
                    title={t("actions.delete")}
                    aria-label={t("actions.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
