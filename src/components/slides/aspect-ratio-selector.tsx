import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface AspectRatioSelectorProps {
  value: string;
  onChange: (ratio: string) => void;
}

const RATIOS = [
  { value: "16:9", label: "16:9", w: 48, h: 27 },
  { value: "4:3", label: "4:3", w: 40, h: 30 },
  { value: "free", label: "Free", w: 44, h: 28 },
];

export function AspectRatioSelector({ value, onChange }: AspectRatioSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">
        {t("presentations.aspectRatio")}
      </label>
      <div className="flex gap-2">
        {RATIOS.map((ratio) => (
          <button
            key={ratio.value}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-colors",
              value === ratio.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground",
            )}
            onClick={() => onChange(ratio.value)}
          >
            <div
              className={cn(
                "rounded border",
                value === ratio.value ? "border-primary bg-primary/20" : "border-muted-foreground/30 bg-muted",
              )}
              style={{ width: ratio.w, height: ratio.h }}
            />
            <span className="text-[10px] font-medium">{ratio.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
