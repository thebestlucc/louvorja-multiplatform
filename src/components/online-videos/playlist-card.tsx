import { useTranslation } from "react-i18next";
import { RefreshCw, Trash2, ListVideo } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { OnlineVideoPlaylist } from "../../lib/bindings";

interface PlaylistCardProps {
  playlist: OnlineVideoPlaylist;
  appDataDir: string;
  onRefresh: (playlistId: string) => void;
  onDelete: (playlistId: string) => void;
  onClick: (playlistId: string) => void;
}

export function PlaylistCard({
  playlist,
  appDataDir,
  onRefresh,
  onDelete,
  onClick,
}: PlaylistCardProps) {
  const { t } = useTranslation();
  const coverUrl = appDataDir && playlist.coverPath
    ? convertFileSrc(`${appDataDir}/${playlist.coverPath}`)
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(playlist.playlistId)}
      onKeyDown={(e) => e.key === "Enter" && onClick(playlist.playlistId)}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:bg-surface-hover text-left cursor-pointer"
    >
      {/* Cover */}
      <div className="relative aspect-video w-full bg-muted">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={playlist.title ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ListVideo className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        {/* Hover actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(playlist.playlistId);
            }}
            className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            title={t("onlineVideos.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(playlist.playlistId);
            }}
            className="rounded-full bg-white/20 p-2 text-white hover:bg-red-500/80"
            title={t("onlineVideos.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <span className="text-sm font-medium truncate">{playlist.title}</span>
        <span className="text-xs text-muted-foreground truncate">
          {playlist.channelTitle}
        </span>
        <span className="text-xs text-muted-foreground">
          {playlist.videoCount ?? 0} {t("onlineVideos.videos")}
        </span>
      </div>
    </div>
  );
}
