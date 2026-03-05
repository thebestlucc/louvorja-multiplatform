import { useTranslation } from "react-i18next";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

export interface TransitionConfig {
  type: string;
  durationMs: number;
}

interface TransitionSelectorProps {
  value: string; // The current implementation expects string
  onChange: (value: string) => void;
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
        value={value}
        onValueChange={onChange}
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
    </div>
  );
}
