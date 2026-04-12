import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VolumeSliderProps {
  volume: number;
  onVolumeChange: (vol: number) => void;
  className?: string;
}

export function VolumeSlider({ volume, onVolumeChange, className }: VolumeSliderProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState<number | null>(null);
  const displayValue = localValue ?? volume;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Volume2 className="h-4 w-4 text-fg-muted flex-shrink-0" aria-hidden="true" />
      <input
        type="range"
        role="slider"
        aria-label={t("remote.queue.volume")}
        min={0}
        max={100}
        value={displayValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onPointerUp={(e) => {
          const val = Number((e.target as HTMLInputElement).value);
          setLocalValue(null);
          onVolumeChange(val);
        }}
        className="flex-1 h-1.5 appearance-none rounded-full bg-border accent-primary cursor-pointer"
      />
    </div>
  );
}
