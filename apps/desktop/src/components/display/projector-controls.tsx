import { useTranslation } from "react-i18next";
import { Monitor, MonitorOff, MonitorSmartphone, Image } from "lucide-react";
import { useMonitorsControl } from "../../hooks/use-monitors";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../../lib/utils";

export function ProjectorControls() {
  const { t } = useTranslation();
  const {
    isProjectorOpen,
    isReturnOpen,
    isBlackScreen,
    isLogoScreen,
    toggleProjector,
    toggleReturn,
    toggleBlackScreen,
    toggleLogoScreen,
  } = useMonitorsControl();

  return (
    <div className="flex items-center gap-1" data-tour="projector-controls">
      {/* Projector toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => toggleProjector()}
            className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10"
            aria-label={isProjectorOpen ? t("display.closeProjector") : t("display.openProjector")}
          >
            <Monitor className="size-3.75" />
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                isProjectorOpen ? "bg-green-500" : "bg-gray-500",
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isProjectorOpen ? t("display.closeProjector") : t("display.openProjector")}
        </TooltipContent>
      </Tooltip>

      {/* Return monitor toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => toggleReturn()}
            className="flex min-h-7 items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10"
            aria-label={isReturnOpen ? t("display.closeReturn") : t("display.openReturn")}
          >
            <MonitorSmartphone className="size-3.75" />
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                isReturnOpen ? "bg-green-500" : "bg-gray-500",
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isReturnOpen ? t("display.closeReturn") : t("display.openReturn")}
        </TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Black screen */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => toggleBlackScreen()}
            className={cn(
              "flex min-h-7 items-center rounded px-2 py-1 hover:bg-white/10",
              isBlackScreen && "bg-white/15 text-yellow-400",
            )}
            aria-label={t("display.toggleBlack")}
          >
            <MonitorOff className="size-3.75" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{t("display.toggleBlack")}</TooltipContent>
      </Tooltip>

      {/* Logo screen */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => toggleLogoScreen()}
            className={cn(
              "flex min-h-7 items-center rounded px-2 py-1 hover:bg-white/10",
              isLogoScreen && "bg-white/15 text-yellow-400",
            )}
            aria-label={t("display.toggleLogo")}
          >
            <Image className="size-3.75" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{t("display.toggleLogo")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
