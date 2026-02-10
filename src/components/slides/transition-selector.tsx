import { useTranslation } from "react-i18next";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

export interface TransitionConfig {
  type: "none" | "fade" | "slide-left" | "slide-right" | "slide-up";
  durationMs: number;
}

interface TransitionSelectorProps {
  value: TransitionConfig;
  onChange: (config: TransitionConfig) => void;
}

const TRANSITION_TYPES = [
  { value: "none", labelKey: "presentations.transNone" },
  { value: "fade", labelKey: "presentations.transFade" },
  { value: "slide-left", labelKey: "presentations.transSlideLeft" },
  { value: "slide-right", labelKey: "presentations.transSlideRight" },
  { value: "slide-up", labelKey: "presentations.transSlideUp" },
];

export function TransitionSelector({ value, onChange }: TransitionSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">
        {t("presentations.transition")}
      </label>
      <Select
        value={value.type}
        onValueChange={(type) => onChange({ ...value, type: type as TransitionConfig["type"] })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRANSITION_TYPES.map((tt) => (
            <SelectItem key={tt.value} value={tt.value}>
              {t(tt.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.type !== "none" && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground shrink-0">
            {t("presentations.duration")}
          </label>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            value={value.durationMs}
            onChange={(e) => onChange({ ...value, durationMs: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-12 text-right">
            {value.durationMs}ms
          </span>
        </div>
      )}
    </div>
  );
}
