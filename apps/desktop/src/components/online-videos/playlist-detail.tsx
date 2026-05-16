import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, Loader2, ListVideo, Pencil } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { VideoCard } from "./video-card";
import { CoverPicker } from "../media/cover-picker";
import {
  useYoutubePlaylistVideos,
  useYoutubePlaylists,
  useRefreshYoutubePlaylist,
  useDeleteVideoLocalFile,
  useUpdateOnlinePlaylistCover,
} from "../../lib/queries";
import { useYoutubeEvents } from "../../hooks/use-youtube-events";
import { getPreference } from "../../lib/store";
import { catcher } from "../../lib/catcher";
import { buildAssetPath } from "../../lib/asset-url";
import { notify } from "../../lib/notifications";

interface PlaylistDetailProps {
  playlistId: string;
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [apiKey, setApiKey] = useState("");
  const [dataDirPath, setDataDirPath] = useState("");
  const [editCoverOpen, setEditCoverOpen] = useState(false);
  const [draftCoverPath, setDraftCoverPath] = useState<string | null>(null);

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
  const deleteLocalMutation = useDeleteVideoLocalFile();
  const updateCoverMutation = useUpdateOnlinePlaylistCover();

  const playlist = playlists?.find((p) => p.playlistId === playlistId);

  const coverUrl =
    playlist?.coverPath && dataDirPath
      ? convertFileSrc(buildAssetPath(dataDirPath, playlist.coverPath))
      : null;

  const handleBack = () => {
    navigate({
      to: "/collections",
      search: { tab: "online-videos" },
    });
  };

  const handleRefresh = () => {
    if (!apiKey) return;
    refreshMutation.mutate({ playlistId, apiKey });
  };

  const handleOpenEditCover = () => {
    setDraftCoverPath(playlist?.coverPath ?? null);
    setEditCoverOpen(true);
  };

  const handleSaveCover = async () => {
    const [, err] = await catcher(
      updateCoverMutation.mutateAsync({ playlistId, coverPath: draftCoverPath }),
      { notify: true },
    );
    if (!err) {
      notify.success(t("onlineVideos.coverUpdated"));
      setEditCoverOpen(false);
    }
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

        {/* Cover image (clickable to edit) */}
        <button
          type="button"
          onClick={handleOpenEditCover}
          className="shrink-0 w-20 aspect-video rounded overflow-hidden bg-muted relative group"
          title={t("onlineVideos.detail.editCover")}
        >
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
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Pencil className="h-4 w-4 text-white" />
          </div>
        </button>

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
                onDeleted={(videoId) => deleteLocalMutation.mutate({ videoId, playlistId })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit cover dialog */}
      <Dialog open={editCoverOpen} onOpenChange={setEditCoverOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("onlineVideos.detail.editCoverTitle")}</DialogTitle>
          </DialogHeader>
          <CoverPicker
            value={draftCoverPath}
            onChange={setDraftCoverPath}
            title={playlist?.title ?? playlistId}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditCoverOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSaveCover} disabled={updateCoverMutation.isPending}>
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
