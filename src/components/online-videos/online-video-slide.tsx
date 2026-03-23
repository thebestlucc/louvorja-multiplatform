import { useTranslation } from "react-i18next";
import type { SlideContent } from "../../lib/bindings";
import { cn } from "../../lib/utils";

export type OnlineVideoRenderMode =
  | "projector"
  | "return-current"
  | "return-next"
  | "editor"
  | "thumbnail";

interface OnlineVideoSlideProps {
  slide: SlideContent;
  renderMode: OnlineVideoRenderMode;
  className?: string;
}

export function OnlineVideoSlide({ slide, renderMode, className }: OnlineVideoSlideProps) {
  const { t } = useTranslation();

  if (renderMode === "projector") {
    return (
      <div className={cn("h-full w-full bg-black", className)}>
        {slide.videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${slide.videoId}?autoplay=1&controls=0&rel=0`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="h-full w-full"
            style={{ border: "none" }}
            title={slide.videoTitle ?? slide.videoId}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
            {t("presentations.types.onlineVideo")}
          </div>
        )}
      </div>
    );
  }

  if (renderMode === "return-current") {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white", className)}>
        <span className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80">
          {t("presentations.types.onlineVideo")}
        </span>
        <p className="text-sm text-center text-white/60 px-4 truncate max-w-full">
          {slide.videoTitle ?? slide.videoId ?? ""}
        </p>
      </div>
    );
  }

  if (renderMode === "return-next") {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white", className)}>
        <span className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80">
          {t("presentations.types.onlineVideo")}
        </span>
        <p className="text-xs text-center text-white/60 px-4 truncate max-w-full">
          {slide.videoTitle ?? slide.videoId ?? ""}
        </p>
      </div>
    );
  }

  if (renderMode === "thumbnail") {
    return (
      <div className={cn("flex h-full w-full min-w-0 max-w-full flex-col items-stretch justify-center gap-1 overflow-hidden px-2 text-center", className)}>
        <span className="self-center rounded bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/80">
          {t("presentations.types.onlineVideo")}
        </span>
        <span
          className="block w-full overflow-hidden break-all text-[10px] leading-tight text-white/60"
          title={slide.videoTitle ?? ""}
        >
          {slide.videoTitle ?? slide.videoId ?? ""}
        </span>
      </div>
    );
  }

  // editor mode
  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      {slide.videoId && (
        <img
          src={`https://i.ytimg.com/vi/${slide.videoId}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-contain"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-xs text-white/80 truncate">{slide.videoTitle ?? ""}</p>
      </div>
    </div>
  );
}
