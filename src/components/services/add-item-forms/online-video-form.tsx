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
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("onlineVideos.addModal.placeholder", "https://youtube.com/watch?v=...")}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        autoFocus
      />
      <Input
        placeholder={t("presentations.onlineVideoTitlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {url.length > 0 && !videoId && (
        <p className="text-xs text-destructive">{t("services.invalidUrl")}</p>
      )}
      <Button
        size="sm"
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
