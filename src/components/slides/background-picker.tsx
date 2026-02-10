import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

export interface BackgroundConfig {
  type: "solid" | "image" | "gradient";
  color?: string;
  imagePath?: string;
  gradientStart?: string;
  gradientEnd?: string;
  position?: string;
  opacity?: number;
}

interface BackgroundPickerProps {
  value: BackgroundConfig;
  onChange: (config: BackgroundConfig) => void;
}

const PRESET_COLORS = [
  "#000000", "#1a1a2e", "#16213e", "#0f3460",
  "#1b1b2f", "#162447", "#1f4068", "#1b262c",
  "#2c3e50", "#34495e", "#2d3436", "#636e72",
  "#6c5ce7", "#a29bfe", "#0984e3", "#74b9ff",
  "#00b894", "#55efc4", "#e17055", "#fab1a0",
];

const POSITIONS = [
  "top left", "top center", "top right",
  "center left", "center", "center right",
  "bottom left", "bottom center", "bottom right",
];

export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const { t } = useTranslation();

  return (
    <Tabs value={value.type} onValueChange={(type) => onChange({ ...value, type: type as BackgroundConfig["type"] })}>
      <TabsList className="w-full">
        <TabsTrigger value="solid" className="flex-1">{t("presentations.bgSolid")}</TabsTrigger>
        <TabsTrigger value="image" className="flex-1">{t("presentations.bgImage")}</TabsTrigger>
        <TabsTrigger value="gradient" className="flex-1">{t("presentations.bgGradient")}</TabsTrigger>
      </TabsList>

      <TabsContent value="solid">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "h-8 w-full rounded-md border-2 transition-colors",
                  value.color === color ? "border-primary" : "border-transparent",
                )}
                style={{ backgroundColor: color }}
                onClick={() => onChange({ ...value, color })}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.color ?? "#000000"}
              onChange={(e) => onChange({ ...value, color: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-border"
            />
            <Input
              value={value.color ?? "#000000"}
              onChange={(e) => onChange({ ...value, color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="image">
        <div className="flex flex-col gap-3">
          <Input
            value={value.imagePath ?? ""}
            onChange={(e) => onChange({ ...value, imagePath: e.target.value })}
            placeholder={t("presentations.imagePathPlaceholder")}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t("presentations.position")}
            </label>
            <div className="grid grid-cols-3 gap-1">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  className={cn(
                    "h-7 rounded border text-[10px]",
                    value.position === pos
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground",
                  )}
                  onClick={() => onChange({ ...value, position: pos })}
                >
                  {pos.replace("center", "C").replace("top", "T").replace("bottom", "B").replace("left", "L").replace("right", "R")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t("presentations.opacity")}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={(value.opacity ?? 100)}
              onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">
              {value.opacity ?? 100}%
            </span>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="gradient">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t("presentations.gradientStart")}
            </label>
            <input
              type="color"
              value={value.gradientStart ?? "#000000"}
              onChange={(e) => onChange({ ...value, gradientStart: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t("presentations.gradientEnd")}
            </label>
            <input
              type="color"
              value={value.gradientEnd ?? "#333333"}
              onChange={(e) => onChange({ ...value, gradientEnd: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-border"
            />
          </div>
          <div
            className="h-12 rounded-md border border-border"
            style={{
              background: `linear-gradient(to bottom, ${value.gradientStart ?? "#000000"}, ${value.gradientEnd ?? "#333333"})`,
            }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
