import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, Loader2 } from "lucide-react";
import { appDataDir } from "@tauri-apps/api/path";
import { Button } from "../../../components/ui/button";
import { ApiKeySetup } from "../../../components/online-videos/api-key-setup";
import { PlaylistCard } from "../../../components/online-videos/playlist-card";
import { AddPlaylistModal } from "../../../components/online-videos/add-playlist-modal";
import {
  useYoutubePlaylists,
  useDeleteYoutubePlaylist,
  useRefreshYoutubePlaylist,
} from "../../../lib/queries";
import { useYoutubeEvents } from "../../../hooks/use-youtube-events";
import { getPreference } from "../../../lib/store";
import { catcher } from "../../../lib/catcher";

export const Route = createFileRoute("/collections/online-videos/")({
  component: OnlineVideosIndex,
});

function OnlineVideosIndex() {
  const { t } = useTranslation();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [dataDirPath, setDataDirPath] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Register YouTube event listeners for query invalidation
  useYoutubeEvents();

  // Load API key from plugin-store and resolve app data dir
  useEffect(() => {
    (async () => {
      const key = await getPreference<string>("youtube_api_key", "");
      setApiKey(key || null);
      setApiKeyLoading(false);
      const dir = await appDataDir();
      setDataDirPath(dir);
    })();
  }, []);

  const { data: playlists, isLoading } = useYoutubePlaylists();
  const deleteMutation = useDeleteYoutubePlaylist();
  const refreshMutation = useRefreshYoutubePlaylist();

  const handleDelete = async (playlistId: string) => {
    await catcher(deleteMutation.mutateAsync(playlistId), { notify: true });
  };

  const handleRefresh = (playlistId: string) => {
    if (!apiKey) return;
    refreshMutation.mutate({ playlistId, apiKey });
  };

  const handlePlaylistClick = (playlistId: string) => {
    router.navigate({
      to: "/collections/online-videos/$playlistId",
      params: { playlistId },
    });
  };

  if (apiKeyLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeySetup />;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("nav.onlineVideos")}</h2>
        <Button onClick={() => setAddModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("onlineVideos.addPlaylist")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !playlists?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("onlineVideos.empty")}
          </p>
          <Button variant="outline" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t("onlineVideos.addPlaylist")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.playlistId}
              playlist={playlist}
              appDataDir={dataDirPath}
              onRefresh={handleRefresh}
              onDelete={handleDelete}
              onClick={handlePlaylistClick}
            />
          ))}
        </div>
      )}

      {apiKey && (
        <AddPlaylistModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          apiKey={apiKey}
        />
      )}
    </div>
  );
}
