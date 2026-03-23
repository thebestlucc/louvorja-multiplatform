import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Download, X, CheckCircle, AlertCircle, Trash2, Play } from "lucide-react";
import type { OnlineVideo } from "../../lib/bindings";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { catcher } from "../../lib/catcher";
import { downloadOnlineVideo, cancelDownload } from "../../lib/tauri";
import { getPreference } from "../../lib/store";
import { cn } from "../../lib/utils";

interface YtdlpProgressPayload {
  runId: string;
  videoId: string;
  percent: number;
  status: string;
}

interface VideoCardProps {
  video: OnlineVideo;
  playlistId: string;
  onDeleted?: (videoId: string) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseThumbnail(images: string | null): string | null {
  if (!images) return null;
  try {
    const parsed = JSON.parse(images) as Record<string, string>;
    return parsed.thumbnail ?? null;
  } catch {
    return null;
  }
}

export function VideoCard({ video, playlistId, onDeleted }: VideoCardProps) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const runIdRef = useRef<string | undefined>(undefined);
  const unlistenRef = useRef<(() => void) | undefined>(undefined);

  // Clean up event listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = undefined;
      }
    };
  }, []);

  const handleDownload = async () => {
    const [quality] = await catcher(
      getPreference<string>("youtube_download_quality", "720"),
    );
    const effectiveQuality = quality ?? "720";

    setDownloading(true);
    setProgress(0);

    // Subscribe to progress events before starting download
    const [unlisten] = await catcher(
      listen<YtdlpProgressPayload>("ytdlp-progress", (event) => {
        if (event.payload.videoId !== video.videoId) return;
        setProgress(event.payload.percent);
        if (
          event.payload.status === "done" ||
          event.payload.status === "error"
        ) {
          setDownloading(false);
          runIdRef.current = undefined;
          if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = undefined;
          }
        }
      }),
    );

    if (unlisten) {
      unlistenRef.current = unlisten;
    }

    const [runId, err] = await catcher(
      downloadOnlineVideo(video.videoId, playlistId, effectiveQuality),
      { notify: true },
    );

    if (err) {
      setDownloading(false);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = undefined;
      }
      return;
    }

    runIdRef.current = runId ?? undefined;
  };

  const handleCancel = async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    await catcher(cancelDownload(runId), { notify: true });
    setDownloading(false);
    setProgress(0);
    runIdRef.current = undefined;
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = undefined;
    }
  };

  const handleDeleteLocal = () => {
    // Signal parent to remove from list or refresh
    if (onDeleted) onDeleted(video.videoId);
  };

  const thumbnailUrl = parseThumbnail(video.images);
  const duration = formatDuration(video.durationSeconds);
  const isDownloaded = !!video.localPath;

  const statusBadge = () => {
    if (isDownloaded) {
      return (
        <Badge className="bg-green-600 text-white text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          {t("onlineVideos.detail.downloaded")}
        </Badge>
      );
    }
    if (video.status === "error") {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          {t("onlineVideos.detail.statusError")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs capitalize">
        {video.status}
      </Badge>
    );
  };

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-hover">
      {/* Thumbnail */}
      <div className="relative shrink-0 w-32 aspect-video rounded overflow-hidden bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.title ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white font-mono">
            {duration}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight line-clamp-2 min-w-0">
            {video.title ?? video.videoId}
          </p>
          <div className="shrink-0">{statusBadge()}</div>
        </div>

        {/* Error message */}
        {video.status === "error" && video.error && (
          <p className="text-xs text-destructive line-clamp-1">{video.error}</p>
        )}

        {/* Progress bar while downloading */}
        {downloading && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("onlineVideos.detail.downloading")}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-auto">
          {downloading ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              title={t("onlineVideos.detail.cancelDownload")}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t("onlineVideos.detail.cancelDownload")}
            </Button>
          ) : isDownloaded ? (
            <button
              type="button"
              onClick={handleDeleteLocal}
              title={t("onlineVideos.detail.deleteLocal")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground",
                "hover:bg-destructive/10 hover:text-destructive transition-colors",
              )}
            >
              <Trash2 className="h-3 w-3" />
              {t("onlineVideos.detail.deleteLocal")}
            </button>
          ) : (
            <Button
              size="sm"
              onClick={handleDownload}
              className="h-7 px-3 text-xs"
              disabled={downloading}
            >
              <Download className="h-3 w-3 mr-1" />
              {t("onlineVideos.detail.download")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
