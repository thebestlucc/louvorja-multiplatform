import { useTranslation } from "react-i18next";
import { Monitor, MonitorOff, MonitorSmartphone, Image } from "lucide-react";
import { useMonitorsControl } from "../../hooks/use-monitors";
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
    <div className="flex items-center gap-1">
      {/* Projector toggle */}
      <button
        onClick={() => toggleProjector()}
        className="flex min-h-[28px] items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10"
        title={isProjectorOpen ? t("display.closeProjector") : t("display.openProjector")}
      >
        <Monitor className="h-[15px] w-[15px]" />
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            isProjectorOpen ? "bg-green-500" : "bg-gray-500",
          )}
        />
      </button>

      {/* Return monitor toggle */}
      <button
        onClick={() => toggleReturn()}
        className="flex min-h-[28px] items-center gap-1.5 rounded px-2 py-1 hover:bg-white/10"
        title={isReturnOpen ? t("display.closeReturn") : t("display.openReturn")}
      >
        <MonitorSmartphone className="h-[15px] w-[15px]" />
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            isReturnOpen ? "bg-green-500" : "bg-gray-500",
          )}
        />
      </button>

      {/* Separator */}
      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Black screen */}
      <button
        onClick={() => toggleBlackScreen()}
        className={cn(
          "flex min-h-[28px] items-center rounded px-2 py-1 hover:bg-white/10",
          isBlackScreen && "bg-white/15 text-yellow-400",
        )}
        title={t("display.toggleBlack")}
      >
        <MonitorOff className="h-[15px] w-[15px]" />
      </button>

      {/* Logo screen */}
      <button
        onClick={() => toggleLogoScreen()}
        className={cn(
          "flex min-h-[28px] items-center rounded px-2 py-1 hover:bg-white/10",
          isLogoScreen && "bg-white/15 text-yellow-400",
        )}
        title={t("display.toggleLogo")}
      >
        <Image className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
