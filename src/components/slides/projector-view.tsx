import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { SlideContentFlat } from "../../types/presentation";
import { flatToSlideContent } from "../../types/presentation";
import { SlideRenderer } from "./slide-renderer";
import type { SlideContent } from "../../types/presentation";

export function ProjectorView() {
  const [slide, setSlide] = useState<SlideContent | null>(null);

  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      setSlide(flatToSlideContent(event.payload));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
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
