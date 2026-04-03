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
  return (
    <div className="flex gap-1.5">
      {RATIOS.map((ratio) => (
        <button
          key={ratio.value}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-1.5 transition-colors cursor-pointer",
            value === ratio.value
              ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
              : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70",
          )}
          onClick={() => onChange(ratio.value)}
        >
          <div
            className={cn(
              "rounded-sm border",
              value === ratio.value ? "border-amber-500/60 bg-amber-500/20" : "border-white/20 bg-white/10",
            )}
            style={{ width: ratio.w * 0.6, height: ratio.h * 0.6 }}
          />
          <span className="text-[10px] font-medium leading-none">{ratio.label}</span>
        </button>
      ))}
    </div>
  );
}
