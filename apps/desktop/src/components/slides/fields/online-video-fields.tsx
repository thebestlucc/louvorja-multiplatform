import { useTranslation } from "react-i18next";
import type { SlideContent, VideoSource } from "../../../lib/bindings";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";

type OnlineVideoSlide = Extract<SlideContent, { slideType: "onlineVideo" }>;

interface OnlineVideoFieldsProps {
  slide: OnlineVideoSlide;
  onChange: (slide: OnlineVideoSlide) => void;
}

function buildSource(url: string): VideoSource {
  // YouTube ID extraction
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    let videoId = url;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes("youtube.com")) {
        videoId = urlObj.searchParams.get("v") ?? url;
      } else if (urlObj.hostname === "youtu.be") {
        videoId = urlObj.pathname.slice(1);
      }
    } catch {
      // raw input as-is
    }
    return { kind: "youtube", video_id: videoId };
  }
  return { kind: "local", url };
}

export function OnlineVideoFields({ slide, onChange }: OnlineVideoFieldsProps) {
  const { t } = useTranslation();

  const handleUrlChange = (url: string) => {
    onChange({
      ...slide,
      source: buildSource(url),
    });
  };

  const currentUrl = slide.source.kind === "local" ? slide.source.url : slide.source.video_id
    ? `https://youtube.com/watch?v=${slide.source.video_id}`
    : "";
  const showVideoId = slide.source.kind === "youtube" && slide.source.video_id;

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.onlineVideoUrl")}
        </label>
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={currentUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1"
          />
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {slide.source.kind === "youtube" ? "YouTube" : "Local"}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.title")}
        </label>
        <Input
          value={slide.title ?? ""}
          onChange={(e) => onChange({ ...slide, title: e.target.value || null })}
          placeholder={t("presentations.onlineVideoTitlePlaceholder")}
        />
      </div>
      {showVideoId && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
            Video ID
          </label>
          <span className="text-xs text-muted-foreground font-mono">
            {slide.source.kind === "youtube" ? slide.source.video_id : ""}
          </span>
        </div>
      )}
    </>
  );
}

