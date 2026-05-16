import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { SlideContent } from "../lib/bindings";
import { getCurrentSlide } from "../lib/tauri/display";

interface UseSlideVersionOptions {
  onSlide: (slide: SlideContent, version: number) => void;
  onClear?: () => void;
  enabled?: boolean;
}

export function useSlideVersion({ onSlide, onClear, enabled = true }: UseSlideVersionOptions): void {
  const onSlideRef = useRef(onSlide);
  const onClearRef = useRef(onClear);
  onSlideRef.current = onSlide;
  onClearRef.current = onClear;

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    const lastVersion = { current: -1 };

    const unlistenChanged = listen<{ slide: SlideContent; version: number }>(
      "slide-changed",
      (event) => {
        if (!isMounted) return;
        const { slide, version } = event.payload;
        if (lastVersion.current >= 0 && version - lastVersion.current > 1) {
          getCurrentSlide()
            .then(({ slide: freshSlide, version: freshVersion }) => {
              if (!isMounted) return;
              lastVersion.current = freshVersion;
              if (freshSlide) onSlideRef.current(freshSlide, freshVersion);
            })
            .catch(() => {});
          return;
        }
        lastVersion.current = version;
        onSlideRef.current(slide, version);
      }
    );

    const unlistenCleared = listen<{ version: number }>("slide-cleared", (event) => {
      if (!isMounted) return;
      lastVersion.current = event.payload.version;
      onClearRef.current?.();
    });

    getCurrentSlide()
      .then(({ slide, version }) => {
        if (!isMounted) return;
        lastVersion.current = version;
        if (slide) onSlideRef.current(slide, version);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      unlistenChanged.then((fn) => fn()).catch(() => {});
      unlistenCleared.then((fn) => fn()).catch(() => {});
    };
  }, [enabled]);
}
