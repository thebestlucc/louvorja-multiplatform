import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

// Types from Rust YoutubePlaylistInfo (not yet in auto-generated bindings)
export interface YoutubePlaylistInfo {
  playlistId: string;
  title: string;
  thumbnailUrl: string;
  videoCount: number;
}

interface PlaylistPickerProps {
  playlists: YoutubePlaylistInfo[];
  existingIds?: Set<string>;
  onConfirm: (selected: YoutubePlaylistInfo[]) => void;
  onCancel: () => void;
  isAdding: boolean;
}

export function PlaylistPicker({
  playlists,
  existingIds,
  onConfirm,
  onCancel,
  isAdding,
}: PlaylistPickerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedPlaylists = playlists.filter((p) => selected.has(p.playlistId));
    onConfirm(selectedPlaylists);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("onlineVideos.addModal.selectPlaylists")}
      </p>
      <div className="max-h-64 overflow-auto space-y-1">
        {playlists.map((p) => {
          const alreadyAdded = existingIds?.has(p.playlistId) ?? false;
          return (
            <label
              key={p.playlistId}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                alreadyAdded
                  ? "cursor-default opacity-50"
                  : "hover:bg-surface-hover cursor-pointer",
              )}
            >
              <input
                type="checkbox"
                checked={alreadyAdded || selected.has(p.playlistId)}
                onChange={() => !alreadyAdded && toggle(p.playlistId)}
                disabled={alreadyAdded}
                className="rounded"
              />
              <span className="flex-1 truncate">{p.title}</span>
              {alreadyAdded ? (
                <span className="text-xs text-muted-foreground italic">
                  {t("onlineVideos.addModal.alreadyAdded")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {p.videoCount} {t("onlineVideos.videos")}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isAdding}>
          {t("actions.cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={selected.size === 0 || isAdding}
        >
          {isAdding
            ? t("onlineVideos.adding")
            : t("onlineVideos.addModal.addSelected", { count: selected.size })}
        </Button>
      </div>
    </div>
  );
}
