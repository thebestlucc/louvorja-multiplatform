import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import type { SlideContentFlat, SlideContent } from "../types/presentation";
import { flatToSlideContent } from "../types/presentation";
import { SlideRenderer } from "../components/slides/slide-renderer";

export const Route = createFileRoute("/return")({
  component: ReturnPage,
});

function ReturnPage() {
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);

  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      setCurrentSlide(flatToSlideContent(event.payload));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black p-4">
      <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-white/10">
        <SlideRenderer
          slide={currentSlide}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
