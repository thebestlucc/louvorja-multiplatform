import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { PlaylistPicker } from "./playlist-picker";
import type { YoutubePlaylistInfo } from "./playlist-picker";
import { catcher } from "../../lib/catcher";
import { fetchYoutubeChannel, addYoutubePlaylist } from "../../lib/tauri";
import { usePresentationStore } from "../../stores/presentation-store";

// Types from Rust YoutubeChannelResult (not yet in auto-generated bindings)
interface YoutubeChannelResult {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  playlists: YoutubePlaylistInfo[];
}

type UrlType = "channel" | "playlist" | "video" | "unknown";

function detectUrlType(url: string): UrlType {
  const trimmed = url.trim();
  if (trimmed.includes("list=")) return "playlist";
  if (trimmed.includes("/channel/") || trimmed.includes("/@")) return "channel";
  if (trimmed.includes("youtu.be/") || trimmed.includes("v=")) return "video";
  return "unknown";
}

interface AddPlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
}

export function AddPlaylistModal({
  open,
  onOpenChange,
  apiKey,
}: AddPlaylistModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [channelResult, setChannelResult] =
    useState<YoutubeChannelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeServiceId = usePresentationStore((s) => s.activeServiceId);

  const urlType = url.trim() ? detectUrlType(url) : null;

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setChannelResult(null);

    if (urlType === "channel") {
      // Listen for the channel fetch result via Tauri events
      const unlisten = await listen<YoutubeChannelResult>(
        "youtube-channel-fetched",
        (event) => {
          setChannelResult(event.payload);
          setLoading(false);
          unlisten();
        },
      );
      const unlistenErr = await listen<string>(
        "youtube-channel-fetch-error",
        (event) => {
          setError(event.payload);
          setLoading(false);
          unlistenErr();
        },
      );
      const [, err] = await catcher(fetchYoutubeChannel(url, apiKey));
      if (err) {
        setLoading(false);
        setError(String(err));
      }
    } else if (urlType === "playlist") {
      // Extract playlist ID and add directly
      const listMatch = url.match(/list=([^&#]+)/);
      if (!listMatch) {
        setError("Could not extract playlist ID");
        setLoading(false);
        return;
      }
      const playlistId = listMatch[1];
      setAdding(true);
      const [, err] = await catcher(
        addYoutubePlaylist(
          {
            playlistId,
            channelId: "",
            channelTitle: "",
            playlistTitle: playlistId,
            thumbnailUrl: "",
          },
          apiKey,
        ),
        { notify: true },
      );
      setAdding(false);
      setLoading(false);
      if (!err) {
        onOpenChange(false);
        resetState();
      }
    }
  };

  const handleAddSelected = async (selected: YoutubePlaylistInfo[]) => {
    if (!channelResult) return;
    setAdding(true);
    for (const pl of selected) {
      await catcher(
        addYoutubePlaylist(
          {
            playlistId: pl.playlistId,
            channelId: channelResult.channelId,
            channelTitle: channelResult.title,
            playlistTitle: pl.title,
            thumbnailUrl: pl.thumbnailUrl,
          },
          apiKey,
        ),
        { notify: true },
      );
    }
    setAdding(false);
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setUrl("");
    setChannelResult(null);
    setError(null);
    setLoading(false);
    setAdding(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("onlineVideos.addModal.title")}</DialogTitle>
        </DialogHeader>

        {!channelResult ? (
          <div className="flex flex-col gap-4">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("onlineVideos.addModal.placeholder")}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            />

            {urlType === "video" && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">
                  {t("onlineVideos.addModal.singleVideo")}
                </p>
                <p className="text-muted-foreground mt-1">
                  {t("onlineVideos.addModal.singleVideoHint")}
                </p>
                {activeServiceId && (
                  <Link
                    to="/services/$serviceId"
                    params={{ serviceId: String(activeServiceId) }}
                  >
                    <Button variant="outline" size="sm" className="mt-2">
                      {t("onlineVideos.addModal.addToService")}
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("actions.cancel")}
              </Button>
              <Button
                onClick={handleFetch}
                disabled={
                  !url.trim() ||
                  urlType === "video" ||
                  urlType === "unknown" ||
                  loading
                }
              >
                {loading && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {urlType === "playlist"
                  ? t("onlineVideos.addModal.addPlaylist")
                  : t("onlineVideos.addModal.fetchChannel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{channelResult.title}</span>
              <span className="text-xs text-muted-foreground">
                {channelResult.playlists.length} {t("onlineVideos.playlists")}
              </span>
            </div>
            {channelResult.playlists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("onlineVideos.addModal.noPlaylists")}
              </p>
            ) : (
              <PlaylistPicker
                playlists={channelResult.playlists}
                onConfirm={handleAddSelected}
                onCancel={() => setChannelResult(null)}
                isAdding={adding}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
