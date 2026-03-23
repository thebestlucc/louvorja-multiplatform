import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, Loader2, ListVideo } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { Button } from "../../../components/ui/button";
import { VideoCard } from "../../../components/online-videos/video-card";
import {
  useYoutubePlaylistVideos,
  useYoutubePlaylists,
  useRefreshYoutubePlaylist,
} from "../../../lib/queries";
import { useYoutubeEvents } from "../../../hooks/use-youtube-events";
import { getPreference } from "../../../lib/store";
import { catcher } from "../../../lib/catcher";

export const Route = createFileRoute("/collections/online-videos/$playlistId")({
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { t } = useTranslation();
  const { playlistId } = Route.useParams();
  const router = useRouter();

  const [apiKey, setApiKey] = useState("");
  const [dataDirPath, setDataDirPath] = useState("");

  // Register YouTube event listeners for query invalidation
  useYoutubeEvents();

  useEffect(() => {
    (async () => {
      const [key] = await catcher(
        getPreference<string>("youtube_api_key", ""),
      );
      setApiKey(key ?? "");
      const [dir] = await catcher(appDataDir());
      setDataDirPath(dir ?? "");
    })();
  }, []);

  const { data: playlists } = useYoutubePlaylists();
  const { data: videos, isLoading } = useYoutubePlaylistVideos(playlistId);
  const refreshMutation = useRefreshYoutubePlaylist();

  const playlist = playlists?.find((p) => p.playlistId === playlistId);

  const coverUrl =
    playlist?.coverPath && dataDirPath
      ? convertFileSrc(`${dataDirPath}/${playlist.coverPath}`)
      : null;

  const handleBack = () => {
    router.navigate({ to: "/collections/online-videos" });
  };

  const handleRefresh = () => {
    if (!apiKey) return;
    refreshMutation.mutate({ playlistId, apiKey });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 border-b border-border shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="shrink-0 mt-1"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("onlineVideos.detail.backToPlaylists")}
        </Button>

        {/* Cover image */}
        <div className="shrink-0 w-20 aspect-video rounded overflow-hidden bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={playlist?.title ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ListVideo className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Playlist info */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight truncate">
            {playlist?.title ?? playlistId}
          </h2>
          {playlist?.channelTitle && (
            <p className="text-sm text-muted-foreground truncate">
              {playlist.channelTitle}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("onlineVideos.detail.videoCount", {
              count: videos?.length ?? playlist?.videoCount ?? 0,
            })}
          </p>
        </div>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending || !apiKey}
          className="shrink-0"
        >
          <RefreshCw
            className={`h-4 w-4 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`}
          />
          {refreshMutation.isPending
            ? t("onlineVideos.detail.refreshing")
            : t("onlineVideos.refresh")}
        </Button>
      </div>

      {/* Video list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !videos?.length ? (
          <div className="flex items-center justify-center p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t("onlineVideos.detail.emptyVideos")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                playlistId={playlistId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
