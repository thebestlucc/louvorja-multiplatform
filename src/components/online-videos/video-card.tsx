import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Download, X, CheckCircle, AlertCircle, Trash2, Play, Monitor, MonitorPlay, Tv } from "lucide-react";
import type { OnlineVideo, SlideContent } from "../../lib/bindings";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { catcher } from "../../lib/catcher";
import { downloadOnlineVideo, cancelDownload, setCurrentSlide, setSlideOnProjector, setSlideOnReturn } from "../../lib/tauri";
import { clearActivePlayback } from "../../lib/projection-playback";
import { getPreference } from "../../lib/store";
import { cn } from "../../lib/utils";
import { useDownloadStore } from "../../stores/download-store";
import { usePresentationStore } from "../../stores/presentation-store";
import { useQueueStore } from "../../stores/queue-store";

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
    const parsed = JSON.parse(images) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return (parsed as Record<string, string>).thumbnail ?? null;
    }
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return images; // plain URL string
  }
}

function buildVideoSlidePayload(video: OnlineVideo): SlideContent {
  const isLocal = !!video.localPath;
  return {
    slideType: "online_video",
    videoId: isLocal ? null : video.videoId,
    videoTitle: video.title ?? "",
    videoUrl: isLocal ? video.localPath : null,
    videoSource: isLocal ? "local" : "youtube",
    text: null, title: null, subtitle: null, label: null,
    videoPath: null, backgroundImage: null, backgroundColor: null,
    audioPath: null, autoPlay: null, loop: null, muted: null,
    mode: null, textColor: null, textSize: null,
  };
}

export function VideoCard({ video, playlistId, onDeleted }: VideoCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentVideoProjectionId = usePresentationStore(
    (s) => s.currentVideoProjectionId,
  );
  const isProjecting =
    !!currentVideoProjectionId && currentVideoProjectionId === video.videoId;
  const download = useDownloadStore((s) => s.downloads[video.videoId]);
  const downloading = !!download;
  const progress = download?.progress ?? 0;
  const runIdRef = useRef<string | undefined>(undefined);

  const handleDownload = async () => {
    const [quality] = await catcher(
      getPreference<string>("youtube_download_quality", "720"),
    );
    const effectiveQuality = quality ?? "720";

    const [runId, err] = await catcher(
      downloadOnlineVideo(video.videoId, playlistId, effectiveQuality),
      { notify: true },
    );

    if (err) {
      return;
    }

    const effectiveRunId = runId ?? "";
    runIdRef.current = effectiveRunId || undefined;
    useDownloadStore.getState().startDownload(video.videoId, playlistId, effectiveRunId);
  };

  const handleCancel = async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    await catcher(cancelDownload(runId), { notify: true });
    useDownloadStore.getState().completeDownload(video.videoId);
    runIdRef.current = undefined;
  };

  const handleDeleteLocal = () => {
    // Signal parent to remove from list or refresh
    if (onDeleted) onDeleted(video.videoId);
  };

  const handleProject = async (target: "all" | "projector" | "return") => {
    if (target === "projector" || target === "return") {
      // Single-screen projection: send directly without affecting queue
      const fn = target === "projector" ? setSlideOnProjector : setSlideOnReturn;
      const [, err] = await catcher(fn(buildVideoSlidePayload(video)), { notify: true });
      if (!err) {
        usePresentationStore.getState().setCurrentVideoProjectionId(video.videoId);
        const { useDisplayStore } = await import("../../stores/display-store");
        useDisplayStore.getState().setCurrentProjectionType("presentation");
      }
      return;
    }

    // "all" target: stop current playback, clear queue, project video
    await clearActivePlayback();
    useQueueStore.getState().clearQueue();

    const payload = buildVideoSlidePayload(video);
    const [, err] = await catcher(setCurrentSlide(payload), { notify: true });
    if (!err) {
      usePresentationStore.getState().setCurrentVideoProjectionId(video.videoId);
      const { useDisplayStore } = await import("../../stores/display-store");
      useDisplayStore.getState().setCurrentProjectionType("presentation");
      void navigate({ to: "/playing-now" });
    }
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
        {isProjecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">
                {t("onlineVideos.detail.nowPlaying")}
              </span>
            </div>
          </div>
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
        <div className="flex items-center gap-2 mt-auto flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleProject("all")}
            title={t("onlineVideos.detail.projectAll")}
            className="h-7 px-2 text-xs"
          >
            <MonitorPlay className="h-3 w-3 mr-1" />
            {t("onlineVideos.detail.projectAll")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleProject("projector")}
            title={t("onlineVideos.detail.projectProjector")}
            className="h-7 px-2 text-xs"
          >
            <Monitor className="h-3 w-3 mr-1" />
            {t("onlineVideos.detail.projectProjector")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleProject("return")}
            title={t("onlineVideos.detail.projectReturn")}
            className="h-7 px-2 text-xs"
          >
            <Tv className="h-3 w-3 mr-1" />
            {t("onlineVideos.detail.projectReturn")}
          </Button>
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
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground cursor-pointer",
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
