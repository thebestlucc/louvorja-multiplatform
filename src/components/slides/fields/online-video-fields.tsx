import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../../types/presentation";
import { Input } from "../../ui/input";

export function OnlineVideoFields({ slide, onChange }: {
  slide: SlideContent;
  onChange: (slide: SlideContent) => void;
}) {
  const { t } = useTranslation();

  const handleUrlChange = (url: string) => {
    // Try to extract video ID from YouTube URL
    let videoId = url;
    const [urlObj, urlErr] = (() => {
      try { return [new URL(url), null]; } catch { return [null, true]; }
    })();
    if (!urlErr && urlObj) {
      if (urlObj.hostname.includes("youtube.com")) {
        videoId = urlObj.searchParams.get("v") ?? url;
      } else if (urlObj.hostname === "youtu.be") {
        videoId = urlObj.pathname.slice(1);
      }
    }
    // If the URL is invalid or no ID could be extracted, use the raw input as-is
    onChange({
      ...slide,
      videoUrl: url,
      videoId: videoId,
      videoSource: "youtube",
    });
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.onlineVideoUrl")}
        </label>
        <Input
          value={slide.videoUrl ?? ""}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.title")}
        </label>
        <Input
          value={slide.videoTitle ?? ""}
          onChange={(e) => onChange({ ...slide, videoTitle: e.target.value })}
          placeholder={t("presentations.onlineVideoTitlePlaceholder")}
        />
      </div>
      {slide.videoId && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
            Video ID
          </label>
          <span className="text-xs text-muted-foreground font-mono">{slide.videoId}</span>
        </div>
      )}
    </>
  );
}
