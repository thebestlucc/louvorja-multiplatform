import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { User, Clock, AlertTriangle, Info } from "lucide-react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { catcherSync } from "../../../lib/catcher";
import { getPreference } from "../../../lib/store";
import { findOnlineVideoByYtId } from "../../../lib/tauri/youtube";
import type { AddItemOnAdd } from "./types";
import type { LiturgyItem } from "../../../types/liturgy";

function extractYouTubeId(input: string): string | null {
  const [u] = catcherSync(() => new URL(input));
  if (!u) return null;
  if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
  return null;
}

interface YtMeta {
  title: string;
  authorName: string;
  thumbnailUrl: string;
  duration: string; // formatted e.g. "4:33", empty if unavailable
}

interface DuplicateInfo {
  inService: LiturgyItem | null;
  inLibrary: { title: string | null; isDownloaded: boolean } | null;
}

function parseIsoDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

interface UrlFormProps {
  onAdd: AddItemOnAdd;
  items?: LiturgyItem[];
  initialUrl?: string;
  initialTitle?: string;
  submitLabel?: string;
}

export function UrlForm({ onAdd, items = [], initialUrl, initialTitle, submitLabel }: UrlFormProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [ytMeta, setYtMeta] = useState<YtMeta | null>(null);
  const [metaState, setMetaState] = useState<"idle" | "loading" | "error">("idle");
  const [downloadOffline, setDownloadOffline] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const apiKeyRef = useRef<string>("");
  // track whether title was auto-filled so we can overwrite it on new oEmbed
  const titleAutoFilledRef = useRef(false);

  // Load YouTube API key once — used for duration fetch
  useEffect(() => {
    getPreference<string>("youtube_api_key", "").then((k) => {
      apiKeyRef.current = k ?? "";
    });
  }, []);

  const videoId = extractYouTubeId(url);
  const isYouTube = videoId !== null;

  const [validUrlData, urlError] = catcherSync(() => new URL(url));
  const isValidUrl = !urlError && !!validUrlData;
  const isUrlEntered = url.length > 0;

  // Show URL error: non-empty, not valid, not a YouTube URL that just hasn't resolved yet
  const showUrlError = isUrlEntered && !isValidUrl;

  useEffect(() => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = undefined;
    }

    if (!videoId) {
      setYtMeta(null);
      setMetaState("idle");
      setDuplicate(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setMetaState("loading");

    const timer = setTimeout(() => {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

      // Optionally fetch duration from YouTube Data API v3 (requires API key)
      const fetchDuration = (): Promise<string> => {
        const key = apiKeyRef.current;
        if (!key || !videoId) return Promise.resolve("");
        return fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`,
          { signal: controller.signal },
        )
          .then((r) => r.json() as Promise<{ items?: { contentDetails: { duration: string } }[] }>)
          .then((d) => parseIsoDuration(d.items?.[0]?.contentDetails?.duration ?? ""))
          .catch(() => "");
      };

      // Check for service-level duplicate (client-side, sync)
      const serviceMatch = items.find((item) => {
        if (item.itemType !== "online_video" || !item.notes) return false;
        const [parsed] = catcherSync(() => JSON.parse(item.notes!) as { videoId?: string });
        return parsed?.videoId === videoId;
      }) ?? null;

      // Fire-and-forget library check — doesn't block oEmbed display
      findOnlineVideoByYtId(videoId).then((found) => {
        if (controller.signal.aborted) return;
        setDuplicate({
          inService: serviceMatch,
          inLibrary: found
            ? { title: found.title ?? null, isDownloaded: found.localPath !== null }
            : null,
        });
      });

      Promise.all([
        fetch(oembedUrl, { signal: controller.signal })
          .then((r) => { if (!r.ok) throw new Error("not ok"); return r.json() as Promise<{ title: string; author_name: string; thumbnail_url: string }>; }),
        fetchDuration(),
      ])
        .then(([data, duration]) => {
          const meta: YtMeta = {
            title: data.title,
            authorName: data.author_name,
            thumbnailUrl: data.thumbnail_url,
            duration,
          };
          setYtMeta(meta);
          setMetaState("idle");
          if (title === "" || titleAutoFilledRef.current) {
            setTitle(meta.title);
            titleAutoFilledRef.current = true;
          }
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setMetaState("error");
        });
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Reset auto-fill flag when title is manually changed
  const handleTitleChange = (val: string) => {
    setTitle(val);
    titleAutoFilledRef.current = false;
  };

  const canSubmit =
    isUrlEntered &&
    isValidUrl &&
    title.trim().length > 0 &&
    !(isYouTube && metaState === "loading");

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isYouTube && videoId) {
      const notes = JSON.stringify({
        videoId,
        videoUrl: url,
        videoSource: "youtube",
        videoTitle: title.trim(),
        channelName: ytMeta?.authorName ?? "",
        duration: ytMeta?.duration ?? "",
        downloadForOffline: downloadOffline,
      });
      onAdd("online_video", title.trim(), null, notes);
    } else {
      onAdd("url", title.trim(), null, url);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* URL input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t("services.urlOrYoutubeLabel")}
        </label>
        <Input
          type="url"
          placeholder={t("services.urlOrYoutubePlaceholder")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          error={showUrlError ? t("services.invalidUrl") : undefined}
        />
      </div>

      {/* Duplicate warnings */}
      {duplicate?.inService && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {t("services.duplicateInService", { title: duplicate.inService.title })}
          </span>
        </div>
      )}

      {duplicate?.inLibrary && (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {duplicate.inLibrary.isDownloaded
              ? t("services.duplicateInLibraryDownloaded", { title: duplicate.inLibrary.title ?? "" })
              : t("services.duplicateInLibrary", { title: duplicate.inLibrary.title ?? "" })}
          </span>
        </div>
      )}

      {/* YouTube preview / skeleton */}
      {isYouTube && metaState === "loading" && (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted p-3 animate-pulse">
          <div className="h-13.5 w-24 rounded bg-muted-foreground/20 shrink-0" />
          <div className="flex flex-col gap-2 flex-1 pt-1">
            <div className="h-3 w-3/4 rounded bg-muted-foreground/20" />
            <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
          </div>
        </div>
      )}

      {isYouTube && metaState === "error" && (
        <p className="text-xs text-destructive">{t("services.ytMetaError")}</p>
      )}

      {isYouTube && ytMeta && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted p-3">
          <div className="flex items-start gap-3">
            <img
              src={ytMeta.thumbnailUrl}
              alt=""
              className="h-13.5 w-24 rounded object-cover shrink-0"
            />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{ytMeta.title}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{ytMeta.authorName}</span>
              </p>
              {ytMeta.duration && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{ytMeta.duration}</span>
                </p>
              )}
            </div>
          </div>
          {/* Offline download checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
            <input
              type="checkbox"
              checked={downloadOffline}
              onChange={(e) => setDownloadOffline(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {t("services.downloadOffline")}
          </label>
        </div>
      )}

      {/* Title field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("services.title")}</label>
        <Input
          placeholder={
            isYouTube
              ? t("presentations.onlineVideoTitlePlaceholder")
              : t("services.urlTitlePlaceholder")
          }
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      </div>

      <Button disabled={!canSubmit} onClick={handleSubmit}>
        {submitLabel ?? t("actions.add")}
      </Button>
    </div>
  );
}
