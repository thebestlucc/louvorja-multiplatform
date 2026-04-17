import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAllSettings } from "../../lib/queries";
import { parseProjectorScreenDefaults } from "../../lib/projector-screen-defaults";
import { useMediaSource } from "../../hooks/use-media-source";
import { cn } from "../../lib/utils";

interface LogoContentProps {
  className?: string;
}

export function LogoContent({ className }: LogoContentProps) {
  const { t } = useTranslation();
  const { data: allSettings } = useAllSettings();
  const screenDefaults = useMemo(() => parseProjectorScreenDefaults(allSettings), [allSettings]);
  const logoImageSrc = useMediaSource(screenDefaults.logoImagePath);

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-black",
        className,
      )}
    >
      {logoImageSrc ? (
        <img
          src={logoImageSrc}
          alt={t("settings.projectorDefaultContentLogo")}
          className="max-h-[70vh] max-w-[80vw] object-contain"
        />
      ) : (
        <span className="text-4xl font-bold text-white/80">LouvorJA</span>
      )}
    </div>
  );
}
