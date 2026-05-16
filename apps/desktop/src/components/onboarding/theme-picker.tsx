import { THEMES, type Theme } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

const THEME_DISPLAY: Record<Theme, { label: string; swatch: string; preview: string }> = {
  azure: { label: "Azure", swatch: "bg-blue-500", preview: "bg-blue-500/10" },
  white: { label: "White", swatch: "bg-gray-200", preview: "bg-gray-50" },
  gray: { label: "Gray", swatch: "bg-gray-500", preview: "bg-gray-500/10" },
  orange: { label: "Orange", swatch: "bg-orange-500", preview: "bg-orange-500/10" },
  black: { label: "Black", swatch: "bg-gray-900", preview: "bg-gray-900/10" },
};

interface ThemePickerProps {
  value: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {THEMES.map((theme) => {
        const display = THEME_DISPLAY[theme];
        const isSelected = value === theme;
        return (
          <button
            key={theme}
            type="button"
            onClick={() => onChange(theme)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-surface hover:border-primary/50",
            )}
          >
            <div className={cn("h-10 w-10 rounded-full", display.swatch)}>
              {isSelected && (
                <div className="flex h-full w-full items-center justify-center">
                  <Check className="h-5 w-5 text-white drop-shadow" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-foreground">{display.label}</span>
          </button>
        );
      })}
    </div>
  );
}
