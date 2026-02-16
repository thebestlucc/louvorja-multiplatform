import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentSlide, clearCurrentSlide, getOverlayState } from "../../lib/tauri";
import type { SlideContentFlat, OverlayState } from "../../types/presentation";
import { flatToSlideContent } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import type { SlideContent } from "../../types/presentation";
import { cn } from "../../lib/utils";

export function ProjectorView() {
  const [slide, setSlide] = useState<SlideContent | null>(null);
  const [blackScreen, setBlackScreen] = useState(false);
  const [logoScreen, setLogoScreen] = useState(false);

  // Listen to slide changes
  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      setSlide(flatToSlideContent(event.payload));
    });

    void getCurrentSlide()
      .then((data) => {
        setSlide(data ? flatToSlideContent(data) : null);
      })
      .catch(() => {});

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen to overlay changes
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-changed", (event) => {
      setBlackScreen(event.payload.blackScreen);
      setLogoScreen(event.payload.logoScreen);
    });

    void getOverlayState()
      .then((state) => {
        setBlackScreen(state.blackScreen);
        setLogoScreen(state.logoScreen);
      })
      .catch(() => {});

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen to slide cleared — reset to logo
  useEffect(() => {
    const unlisten = listen("slide-cleared", () => {
      setSlide(null);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Keyboard handling: ESC clears content to logo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearCurrentSlide().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showLogo = !slide || logoScreen;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <SlideRenderer
        slide={slide}
        className="h-full w-full transition-opacity duration-300"
      />
      {/* Black screen overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-black transition-opacity duration-500",
          blackScreen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Logo screen overlay (also shown when no slide content) */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-500",
          showLogo ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <span className="text-4xl font-bold text-white/80">LouvorJA</span>
      </div>
    </div>
  );
}
