import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { SlideThumbnail } from "../slides/slide-thumbnail";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { getPreference, setPreference } from "../../lib/store";
import type { SlideContent } from "../../lib/bindings";

interface SlidePanelProps {
  slides: SlideContent[];
  activeSlideIndex: number;
  onSlideClick: (index: number) => void;
  visible: boolean;
}

const PREF_KEY = "playing-now-slide-panel-collapsed";

export function SlidePanel({ slides, activeSlideIndex, onSlideClick, visible }: SlidePanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Load collapse preference on mount
  useEffect(() => {
    getPreference(PREF_KEY, false).then(setCollapsed);
  }, []);

  // Auto-scroll active slide into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeSlideIndex]);

  if (!visible) return null;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPreference(PREF_KEY, next);
  };

  return (
    <div
      className="relative flex h-full flex-col border-r border-border bg-muted/30 overflow-hidden transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 40 : 200 }}
    >
      {/* Collapsed state */}
      <div
        className="absolute inset-0 flex flex-col items-center pt-2 gap-2 transition-opacity duration-200"
        style={{ opacity: collapsed ? 1 : 0, pointerEvents: collapsed ? "auto" : "none" }}
      >
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggleCollapsed}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <span className="writing-vertical-lr text-xs text-muted-foreground">
          {t("playingNow.slides")} ({slides.length})
        </span>
      </div>

      {/* Expanded state */}
      <div
        className="flex h-full w-[200px] flex-col transition-opacity duration-200"
        style={{ opacity: collapsed ? 0 : 1, pointerEvents: collapsed ? "none" : "auto" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("playingNow.slides")} ({slides.length})
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleCollapsed}>
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Thumbnail list */}
        <ScrollArea className="flex-1 p-2">
          <div className="flex flex-col gap-2">
            {slides.map((slide, i) => (
              <div key={i} ref={i === activeSlideIndex ? activeRef : undefined}>
                <SlideThumbnail
                  slide={slide}
                  index={i}
                  isActive={i === activeSlideIndex}
                  onClick={() => onSlideClick(i)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
