import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { catcher } from "../../lib/catcher";
import { useCopyImageToMedia } from "../../lib/queries";
import { getPreference, setPreference } from "../../lib/store";
import { cn } from "../../lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { SlideRenderer } from "../slides/slide-renderer";
import type { SlideContent } from "../../lib/bindings";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  X,
} from "lucide-react";

export interface BibleProjectionSettings {
  backgroundColor: string;
  backgroundImage: string | null;
  backgroundGradient: { from: string; to: string; angle: number } | null;
  textColor: string;
  textSize: number;
  textShadow: boolean;
  textAlign: "left" | "center" | "right";
  showReference: boolean;
  referencePosition: "top" | "bottom";
}

const DEFAULT_SETTINGS: BibleProjectionSettings = {
  backgroundColor: "#0a0a0a",
  backgroundImage: null,
  backgroundGradient: null,
  textColor: "#ffffff",
  textSize: 48,
  textShadow: true,
  textAlign: "center",
  showReference: true,
  referencePosition: "top",
};

const STORE_KEY = "bibleProjectionSettings";

const PRESET_COLORS = [
  "#000000", "#0a0a0a", "#1a1a2e", "#16213e",
  "#0f3460", "#1b1b2f", "#162447", "#1f4068",
  "#1b262c", "#2c3e50", "#34495e", "#2d3436",
];

const GRADIENT_PRESETS = [
  { name: "Night Sky", from: "#0a0a0a", to: "#1a1a2e", angle: 135 },
  { name: "Deep Ocean", from: "#0d1b2a", to: "#1b4965", angle: 180 },
  { name: "Dusk", from: "#2d1b69", to: "#11998e", angle: 150 },
  { name: "Ember", from: "#1a0a00", to: "#8b2500", angle: 160 },
  { name: "Midnight", from: "#000000", to: "#434343", angle: 180 },
  { name: "Royal", from: "#0f0c29", to: "#302b63", angle: 135 },
  { name: "Forest", from: "#0a2e0a", to: "#134e2a", angle: 160 },
  { name: "Slate", from: "#1c1c2e", to: "#2d3561", angle: 180 },
  { name: "Crimson", from: "#1a0010", to: "#6b0026", angle: 150 },
  { name: "Gold Fade", from: "#1a1200", to: "#3d2b00", angle: 145 },
];

interface ProjectionSettingsProps {
  settings: BibleProjectionSettings;
  onChange: (settings: BibleProjectionSettings) => void;
  preview?: SlideContent | null;
}

export function useProjectionSettings() {
  const [settings, setSettings] = useState<BibleProjectionSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [saved] = await catcher(
        getPreference<BibleProjectionSettings>(STORE_KEY, DEFAULT_SETTINGS),
      );
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
      }
      setLoaded(true);
    };
    void load();
  }, []);

  const updateSettings = useCallback(
    (next: BibleProjectionSettings) => {
      setSettings(next);
      void catcher(setPreference(STORE_KEY, next));
    },
    [],
  );

  return { settings, updateSettings, loaded };
}

export function buildBibleSlideContent(
  text: string,
  reference: string,
  settings: BibleProjectionSettings,
): SlideContent {
  let bgColor = settings.backgroundColor;
  if (settings.backgroundGradient) {
    bgColor = settings.backgroundGradient.from;
  }

  const modeTokens: string[] = [];
  if (settings.textAlign !== "center") modeTokens.push(`align-${settings.textAlign}`);
  if (settings.referencePosition === "bottom") modeTokens.push("ref-bottom");
  if (!settings.showReference) modeTokens.push("no-ref");
  if (settings.textShadow) modeTokens.push("text-shadow");
  if (settings.backgroundGradient) {
    modeTokens.push(
      `gradient-${settings.backgroundGradient.angle}-${settings.backgroundGradient.from.replace("#", "")}-${settings.backgroundGradient.to.replace("#", "")}`,
    );
  }

  return {
    slideType: "bible",
    text,
    title: settings.showReference ? reference : null,
    subtitle: null,
    label: settings.showReference ? reference : null,
    videoPath: null,
    backgroundImage: settings.backgroundImage,
    backgroundColor: bgColor,
    audioPath: null,
    autoPlay: null,
    loop: null,
    muted: null,
    mode: modeTokens.length > 0 ? modeTokens.join(" ") : null,
    textColor: settings.textColor,
    textSize: settings.textSize,
    videoUrl: null,
    videoId: null,
    videoSource: null,
    videoTitle: null,
  };
}

export function ProjectionSettings({
  settings,
  onChange,
  preview,
}: ProjectionSettingsProps) {
  const { t } = useTranslation();
  const copyImageMutation = useCopyImageToMedia();

  const bgType: "solid" | "gradient" | "image" = settings.backgroundGradient
    ? "gradient"
    : settings.backgroundImage !== null
      ? "image"
      : "solid";

  const handleBgTypeChange = (type: string) => {
    if (type === "solid") {
      onChange({
        ...settings,
        backgroundGradient: null,
        backgroundImage: null,
      });
    } else if (type === "gradient") {
      onChange({
        ...settings,
        backgroundGradient: settings.backgroundGradient ?? {
          from: GRADIENT_PRESETS[0].from,
          to: GRADIENT_PRESETS[0].to,
          angle: GRADIENT_PRESETS[0].angle,
        },
        backgroundImage: null,
      });
    } else if (type === "image") {
      onChange({
        ...settings,
        backgroundGradient: null,
        backgroundImage: settings.backgroundImage || "",
      });
    }
  };

  const previewSlide: SlideContent = preview ?? buildBibleSlideContent(
    t("bible.previewText"),
    "John 3:16",
    settings,
  );

  const previewStyle: React.CSSProperties = {};
  if (settings.backgroundGradient) {
    previewStyle.background = `linear-gradient(${settings.backgroundGradient.angle}deg, ${settings.backgroundGradient.from}, ${settings.backgroundGradient.to})`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* WYSIWYG Preview */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("bible.projectionPreview")}
        </span>
        <div
          className="relative aspect-video w-full overflow-hidden rounded-lg border border-border"
          style={previewStyle}
        >
          <SlideRenderer
            slide={previewSlide}
            renderMode="thumbnail"
            className="h-full w-full"
          />
          {/* Overlay text-shadow simulation for thumbnail */}
          {settings.textShadow && (
            <div className="pointer-events-none absolute inset-0 rounded-lg" />
          )}
        </div>
      </div>

      {/* Background Section */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("bible.projectionBackground")}
        </span>
        <Tabs value={bgType} onValueChange={handleBgTypeChange}>
          <TabsList className="w-full">
            <TabsTrigger value="solid" className="flex-1 text-xs">
              {t("presentations.bgSolid")}
            </TabsTrigger>
            <TabsTrigger value="gradient" className="flex-1 text-xs">
              {t("presentations.bgGradient")}
            </TabsTrigger>
            <TabsTrigger value="image" className="flex-1 text-xs">
              {t("presentations.bgImage")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solid">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-6 gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-6 w-full rounded border-2 transition-colors",
                      settings.backgroundColor === color
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/40",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      onChange({ ...settings, backgroundColor: color })
                    }
                    aria-label={`${t("bible.projectionBackground")}: ${color}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      backgroundColor: e.target.value,
                    })
                  }
                  className="h-7 w-7 cursor-pointer rounded border border-border"
                  aria-label={t("bible.projectionBackground")}
                />
                <Input
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      backgroundColor: e.target.value,
                    })
                  }
                  className="h-7 flex-1 text-xs"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gradient">
            <div className="grid grid-cols-3 gap-1.5">
              {GRADIENT_PRESETS.map((preset, idx) => {
                const isSelected =
                  settings.backgroundGradient?.from === preset.from &&
                  settings.backgroundGradient?.to === preset.to;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cn(
                      "aspect-video w-full rounded border-2 transition-colors",
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "border-transparent hover:border-muted-foreground/40",
                    )}
                    style={{
                      background: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})`,
                    }}
                    onClick={() =>
                      onChange({
                        ...settings,
                        backgroundGradient: {
                          from: preset.from,
                          to: preset.to,
                          angle: preset.angle,
                        },
                      })
                    }
                    aria-label={preset.name}
                    aria-pressed={isSelected}
                  />
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="image">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs shrink-0"
                  onClick={async () => {
                    const [selected] = await catcher(openFileDialog({
                      multiple: false,
                      filters: [
                        {
                          name: t("bible.imageFilter"),
                          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "avif"],
                        },
                      ],
                    }));
                    if (typeof selected === "string") {
                      const [managedPath] = await catcher(
                        copyImageMutation.mutateAsync(selected),
                        { notify: true },
                      );
                      if (managedPath) {
                        onChange({ ...settings, backgroundImage: managedPath });
                      }
                    }
                  }}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {t("actions.browse")}
                </Button>
                {settings.backgroundImage && (
                  <span className="flex-1 truncate text-xs text-muted-foreground" title={settings.backgroundImage}>
                    {settings.backgroundImage.split(/[\\/]/).pop()}
                  </span>
                )}
                {!settings.backgroundImage && (
                  <span className="flex-1 text-xs text-muted-foreground/60 italic">
                    {t("presentations.imagePathPlaceholder")}
                  </span>
                )}
                {settings.backgroundImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onChange({ ...settings, backgroundImage: null })}
                    aria-label={t("actions.clear")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Typography Section */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("bible.projectionTypography")}
        </span>

        {/* Font Size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0 w-14">
            {t("bible.projectionFontSize")}
          </span>
          <Slider
            value={[settings.textSize]}
            onValueChange={([val]) =>
              onChange({ ...settings, textSize: val })
            }
            min={24}
            max={96}
            step={2}
            className="flex-1"
            aria-label={t("bible.projectionFontSize")}
          />
          <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
            {settings.textSize}px
          </span>
        </div>

        {/* Text Color */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0 w-14">
            {t("bible.projectionTextColor")}
          </span>
          <input
            type="color"
            value={settings.textColor}
            onChange={(e) =>
              onChange({ ...settings, textColor: e.target.value })
            }
            className="h-7 w-7 cursor-pointer rounded border border-border"
            aria-label={t("bible.projectionTextColor")}
          />
          <Input
            value={settings.textColor}
            onChange={(e) =>
              onChange({ ...settings, textColor: e.target.value })
            }
            className="h-7 flex-1 text-xs"
          />
        </div>

        {/* Text Shadow Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("bible.projectionTextShadow")}
          </span>
          <Button
            variant={settings.textShadow ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              onChange({ ...settings, textShadow: !settings.textShadow })
            }
            aria-pressed={settings.textShadow}
          >
            {settings.textShadow ? t("bible.projectionOn") : t("bible.projectionOff")}
          </Button>
        </div>

        {/* Text Alignment */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("bible.projectionAlignment")}
          </span>
          <div className="flex gap-0.5">
            {([
              { value: "left" as const, icon: AlignLeft },
              { value: "center" as const, icon: AlignCenter },
              { value: "right" as const, icon: AlignRight },
            ]).map(({ value, icon: Icon }) => (
              <Button
                key={value}
                variant={settings.textAlign === value ? "default" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onChange({ ...settings, textAlign: value })}
                aria-label={value}
                aria-pressed={settings.textAlign === value}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Reference Section */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("bible.projectionReference")}
        </span>

        {/* Show/Hide Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("bible.projectionShowReference")}
          </span>
          <Button
            variant={settings.showReference ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() =>
              onChange({ ...settings, showReference: !settings.showReference })
            }
            aria-pressed={settings.showReference}
          >
            {settings.showReference ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            {settings.showReference ? t("bible.projectionOn") : t("bible.projectionOff")}
          </Button>
        </div>

        {/* Position Toggle */}
        {settings.showReference && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("bible.projectionPosition")}
            </span>
            <div className="flex gap-0.5">
              <Button
                variant={
                  settings.referencePosition === "top" ? "default" : "ghost"
                }
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() =>
                  onChange({ ...settings, referencePosition: "top" })
                }
                aria-pressed={settings.referencePosition === "top"}
              >
                <ArrowUp className="h-3 w-3" />
                {t("bible.projectionTop")}
              </Button>
              <Button
                variant={
                  settings.referencePosition === "bottom" ? "default" : "ghost"
                }
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() =>
                  onChange({ ...settings, referencePosition: "bottom" })
                }
                aria-pressed={settings.referencePosition === "bottom"}
              >
                <ArrowDown className="h-3 w-3" />
                {t("bible.projectionBottom")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
