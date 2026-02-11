import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentSlide, closeProjectorWindow } from "../../lib/tauri";
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

  // Close the projector window on ESC (uses Tauri command so backend state stays in sync).
  // Use capture phase to intercept before OS fullscreen handler can swallow the event.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeProjectorWindow().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
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
