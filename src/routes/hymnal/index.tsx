import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAlbums, useCreateHymn, useHymnsByAlbum } from "../../lib/queries";
import { HymnSearch } from "../../components/music/hymn-search";
import { AlbumCard } from "../../components/music/album-card";
import { HymnCard } from "../../components/music/hymn-card";
import { Button } from "../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/hymnal/")({
  component: HymnalIndex,
});

function HymnalIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const { data: albums, isLoading: albumsLoading } = useAlbums();
  const { data: albumHymns } = useHymnsByAlbum(selectedAlbum ?? "");
  const createMutation = useCreateHymn();

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const parsedNumber = newNumber.trim().length > 0 ? Number(newNumber) : null;
    try {
      const result = await createMutation.mutateAsync({
        number: Number.isFinite(parsedNumber) ? parsedNumber : null,
        title,
        author: null,
        album: null,
        lyrics: null,
        chords: null,
        audio_path: null,
        category: null,
        notes: null,
        cover_path: null,
      });
      setNewTitle("");
      setNewNumber("");
      navigate({ to: "/hymnal/$hymnId", params: { hymnId: String(result.id) } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("hymnal.createFailed", { error: message }));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.hymnal")}</h1>
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[8rem_1fr_auto]">
        <Input
          type="number"
          value={newNumber}
          onChange={(event) => setNewNumber(event.target.value)}
          placeholder={t("hymnal.numberPlaceholder")}
        />
        <Input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder={t("hymnal.createPlaceholder")}
        />
        <Button onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending}>
          {t("hymnal.create")}
        </Button>
      </div>

      <HymnSearch />

      {selectedAlbum ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedAlbum(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-medium">{selectedAlbum}</h2>
          </div>
          {albumHymns && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {albumHymns.map((hymn) => (
                <HymnCard key={hymn.id} hymn={hymn} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">{t("hymnal.albums")}</h2>
          {albumsLoading && (
            <p className="text-sm text-muted-foreground">{t("hymnal.loading")}</p>
          )}
          {albums && albums.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <AlbumCard
                  key={album.name}
                  album={album}
                  onClick={setSelectedAlbum}
                />
              ))}
            </div>
          )}
          {albums && albums.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("hymnal.noAlbums")}</p>
          )}
        </div>
      )}
    </div>
  );
}
