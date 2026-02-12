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
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10"
        title={isProjectorOpen ? t("display.closeProjector") : t("display.openProjector")}
      >
        <Monitor className="h-3.5 w-3.5" />
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            isProjectorOpen ? "bg-green-500" : "bg-gray-500",
          )}
        />
      </button>

      {/* Return monitor toggle */}
      <button
        onClick={() => toggleReturn()}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10"
        title={isReturnOpen ? t("display.closeReturn") : t("display.openReturn")}
      >
        <MonitorSmartphone className="h-3.5 w-3.5" />
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            isReturnOpen ? "bg-green-500" : "bg-gray-500",
          )}
        />
      </button>

      {/* Separator */}
      <div className="mx-0.5 h-3 w-px bg-border" />

      {/* Black screen */}
      <button
        onClick={() => toggleBlackScreen()}
        className={cn(
          "flex items-center rounded px-1.5 py-0.5 hover:bg-white/10",
          isBlackScreen && "bg-white/15 text-yellow-400",
        )}
        title={t("display.toggleBlack")}
      >
        <MonitorOff className="h-3.5 w-3.5" />
      </button>

      {/* Logo screen */}
      <button
        onClick={() => toggleLogoScreen()}
        className={cn(
          "flex items-center rounded px-1.5 py-0.5 hover:bg-white/10",
          isLogoScreen && "bg-white/15 text-yellow-400",
        )}
        title={t("display.toggleLogo")}
      >
        <Image className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
