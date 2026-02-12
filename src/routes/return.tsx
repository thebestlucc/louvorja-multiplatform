import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import type { SlideContentFlat, SlideContent, SlideContextFlat, OverlayState } from "../types/presentation";
import { flatToSlideContent } from "../types/presentation";
import { getCurrentSlide, getSlideContext, getOverlayState, closeReturnWindow } from "../lib/tauri";
import { SlideRenderer } from "../components/slides/slide-renderer";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/return")({
  component: ReturnPage,
});

function ReturnPage() {
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [nextSlide, setNextSlide] = useState<SlideContent | null>(null);
  const [slideTitle, setSlideTitle] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideTotal, setSlideTotal] = useState(0);
  const [clock, setClock] = useState("");
  const [blackScreen, setBlackScreen] = useState(false);
  const [logoScreen, setLogoScreen] = useState(false);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current state on mount
  useEffect(() => {
    getCurrentSlide().then((data) => {
      if (data) setCurrentSlide(flatToSlideContent(data));
    });
    getSlideContext().then((ctx) => {
      if (ctx) {
        setNextSlide(ctx.next ? flatToSlideContent(ctx.next) : null);
        setSlideIndex(ctx.index);
        setSlideTotal(ctx.total);
        setSlideTitle(ctx.title);
      }
    });
    getOverlayState().then((state) => {
      setBlackScreen(state.blackScreen);
      setLogoScreen(state.logoScreen);
    });
  }, []);

  // Listen to slide changes
  useEffect(() => {
    const unlisten = listen<SlideContentFlat>("slide-changed", (event) => {
      setCurrentSlide(flatToSlideContent(event.payload));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen to slide context
  useEffect(() => {
    const unlisten = listen<SlideContextFlat>("slide-context", (event) => {
      const ctx = event.payload;
      setNextSlide(ctx.next ? flatToSlideContent(ctx.next) : null);
      setSlideIndex(ctx.index);
      setSlideTotal(ctx.total);
      setSlideTitle(ctx.title);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen to overlay changes
  useEffect(() => {
    const unlisten = listen<OverlayState>("overlay-changed", (event) => {
      setBlackScreen(event.payload.blackScreen);
      setLogoScreen(event.payload.logoScreen);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen to slide cleared — reset to logo
  useEffect(() => {
    const unlisten = listen("slide-cleared", () => {
      setCurrentSlide(null);
      setNextSlide(null);
      setSlideTitle("");
      setSlideIndex(0);
      setSlideTotal(0);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Keyboard: ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeReturnWindow().catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasOverlay = blackScreen || logoScreen;
  const noContent = !currentSlide && !hasOverlay;

  if (noContent) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 text-white">
        <span className="text-4xl font-bold text-white/80">LouvorJA</span>
        <span className="mt-3 font-mono text-sm text-white/40">{clock}</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 p-3 text-white">
      {/* Current slide — top 70% */}
      <div className="relative flex-[7] overflow-hidden rounded-lg border border-white/10">
        <SlideRenderer
          slide={currentSlide}
          className="h-full w-full"
        />
        {/* Overlay indicator */}
        {hasOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="rounded bg-red-600 px-4 py-2 text-lg font-bold uppercase tracking-wider">
              {blackScreen ? "BLACK SCREEN" : "LOGO SCREEN"}
            </span>
          </div>
        )}
      </div>

      {/* Metadata bar */}
      <div className="flex items-center justify-between px-2 py-2 text-sm">
        <span className="truncate font-medium text-white/90">{slideTitle}</span>
        <div className="flex items-center gap-4">
          {slideTotal > 0 && (
            <span className="text-white/60">
              {slideIndex + 1} / {slideTotal}
            </span>
          )}
          <span className={cn("font-mono text-white/60", hasOverlay && "text-red-400")}>
            {clock}
          </span>
        </div>
      </div>

      {/* Next slide — bottom 30% */}
      <div className="flex-[3] overflow-hidden rounded-lg border border-white/5 bg-neutral-900">
        {nextSlide ? (
          <div className="relative h-full w-full">
            <div className="absolute left-2 top-1 z-10 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
              Next
            </div>
            <SlideRenderer
              slide={nextSlide}
              className="h-full w-full opacity-70"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/30">
            No next slide
          </div>
        )}
      </div>
    </div>
  );
}
