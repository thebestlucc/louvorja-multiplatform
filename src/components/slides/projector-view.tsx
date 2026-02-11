import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentSlide, closeProjectorWindow, navigateBibleVerse } from "../../lib/tauri";
import type { SlideContentFlat } from "../../types/presentation";
import { flatToSlideContent } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import type { SlideContent } from "../../types/presentation";

export function ProjectorView() {
  const [slide, setSlide] = useState<SlideContent | null>(null);

  // Fetch current slide on mount (handles race condition when projector opens after slide is set)
  useEffect(() => {
    getCurrentSlide().then((data) => {
      if (data) setSlide(flatToSlideContent(data));
    });
  }, []);

  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      setSlide(flatToSlideContent(event.payload));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Keyboard handling: ESC to close, arrows for Bible navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closeProjectorWindow().catch(() => {});
          break;
        case "ArrowRight":
          e.preventDefault();
          navigateBibleVerse("next").catch(() => {});
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigateBibleVerse("prev").catch(() => {});
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <SlideRenderer
        slide={slide}
        className="h-full w-full transition-opacity duration-300"
      />
    </div>
  );
}
