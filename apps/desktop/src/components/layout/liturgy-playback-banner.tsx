import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Square, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";
import type { Liturgy, LiturgyItem } from "../../lib/bindings";

export interface LiturgyPlaybackBannerProps {
  service: Liturgy;
  activeLiturgyId: number;
  activeItemIndex: number;
  items: LiturgyItem[];
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
}

export function LiturgyPlaybackBanner({
  service,
  activeLiturgyId,
  activeItemIndex,
  items,
  onPrev,
  onNext,
  onStop,
}: LiturgyPlaybackBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 bg-primary px-4 py-2.5 text-primary-foreground shrink-0">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider">
          {t("services.liveIndicator")}
        </span>
      </div>
      <span className="text-sm font-semibold truncate max-w-50">
        {service.title}
      </span>
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium tabular-nums shrink-0">
        {t("services.progressOf", {
          current: activeItemIndex + 1,
          total: items.length,
        })}
      </span>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/15"
          onClick={onPrev}
          disabled={activeItemIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-primary-foreground hover:bg-white/15"
          onClick={onNext}
          disabled={items.length === 0}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Link to="/services/$serviceId" params={{ serviceId: String(activeLiturgyId) }}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-primary-foreground hover:bg-white/15"
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            {t("services.goToLiturgy")}
          </Button>
        </Link>
        <Button
          size="sm"
          variant="destructive"
          className="ml-1 h-7 px-3 text-xs"
          onClick={onStop}
        >
          <Square className="mr-1.5 h-3 w-3" />
          {t("services.stopService")}
        </Button>
      </div>
    </div>
  );
}
