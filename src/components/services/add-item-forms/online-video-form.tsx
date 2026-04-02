import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import type { AddItemOnAdd } from "./types";

export function OnlineVideoForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const extractVideoId = (input: string): string | null => {
    const [urlObj, urlErr] = (() => {
      try { return [new URL(input), null]; } catch { return [null, true]; }
    })();
    if (!urlErr && urlObj) {
      if (urlObj.hostname.includes("youtube.com")) {
        return urlObj.searchParams.get("v");
      }
      if (urlObj.hostname === "youtu.be") {
        return urlObj.pathname.slice(1) || null;
      }
    }
    // might be a raw video ID
    if (/^[\w-]{11}$/.test(input)) return input;
    return null;
  };

  const videoId = extractVideoId(url);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">URL do YouTube</label>
        <Input
          placeholder={t("onlineVideos.addModal.placeholder", "https://youtube.com/watch?v=...")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          error={url.length > 0 && !videoId ? t("services.invalidUrl") : undefined}
        />
      </div>

      {videoId && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt=""
            className="h-14 w-24 rounded object-cover shrink-0"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            ID: <span className="font-mono text-foreground">{videoId}</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("services.title")}</label>
        <Input
          placeholder={t("presentations.onlineVideoTitlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <Button
        disabled={!videoId || title.trim().length === 0}
        onClick={() => {
          const notes = JSON.stringify({
            videoId,
            videoUrl: url,
            videoSource: "youtube",
            videoTitle: title.trim(),
          });
          onAdd("online_video", title.trim(), null, notes);
        }}
      >
        {t("actions.add")}
      </Button>
    </div>
  );
}
