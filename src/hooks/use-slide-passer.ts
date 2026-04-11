import { useCallback, useEffect, useRef } from "react";
import { useSlidePasserStore } from "../stores/slide-passer-store";
import { useSlides } from "./use-slides";
import { useMonitorsControl } from "./use-monitors";
import { useDisplayStore } from "../stores/display-store";
import { navigateBible } from "../lib/tauri";
import { invoke } from "@tauri-apps/api/core";

export function useSlidePasser({ enabled = true }: { enabled?: boolean } = {}) {
  const config = useSlidePasserStore((s) => s.config);
  const recordEvent = useSlidePasserStore((s) => s.recordEvent);
  const clearActive = useSlidePasserStore((s) => s.clearActive);
  const { nextSlide, prevSlide } = useSlides();
  const { toggleProjector, toggleBlackScreen } = useMonitorsControl();

  // Refs for stable closure access
  const nextSlideRef = useRef(nextSlide);
  const prevSlideRef = useRef(prevSlide);
  const toggleProjectorRef = useRef(toggleProjector);
  const toggleBlackScreenRef = useRef(toggleBlackScreen);

  useEffect(() => { nextSlideRef.current = nextSlide; }, [nextSlide]);
  useEffect(() => { prevSlideRef.current = prevSlide; }, [prevSlide]);
  useEffect(() => { toggleProjectorRef.current = toggleProjector; }, [toggleProjector]);
  useEffect(() => { toggleBlackScreenRef.current = toggleBlackScreen; }, [toggleBlackScreen]);

  const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInternalAction = useCallback((action: string) => {
    const projType = useDisplayStore.getState().currentProjectionType;

    switch (action) {
      case "nextSlide":
        if (projType === "bible") void navigateBible("next");
        else nextSlideRef.current();
        break;
      case "prevSlide":
        if (projType === "bible") void navigateBible("prev");
        else prevSlideRef.current();
        break;
      case "blackScreen":
        void toggleBlackScreenRef.current();
        break;
      case "toggleProjection":
        void toggleProjectorRef.current();
        break;
    }
  }, []);

  const handleExternalAction = useCallback((action: string) => {
    const { externalApp, customExternalKeys } = useSlidePasserStore.getState().config;

    let key: string | null = null;
    if (externalApp === "custom" && customExternalKeys) {
      switch (action) {
        case "nextSlide": key = customExternalKeys.next; break;
        case "prevSlide": key = customExternalKeys.prev; break;
        case "blackScreen": key = customExternalKeys.black; break;
        case "toggleProjection": key = customExternalKeys.startShow; break;
      }
    } else {
      switch (action) {
        case "nextSlide": key = "PageDown"; break;
        case "prevSlide": key = "PageUp"; break;
        case "blackScreen": key = "b"; break;
        case "toggleProjection": key = "F5"; break;
      }
    }

    if (key) {
      void invoke("send_keystroke", { key });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !config.enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when focus is in text inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const pressedKey = e.key;
      const { mappings, mode } = useSlidePasserStore.getState().config;

      // Find which action this key maps to
      let matchedAction: string | null = null;
      for (const [action, mappedKey] of Object.entries(mappings)) {
        if (mappedKey && pressedKey === mappedKey) {
          matchedAction = action;
          break;
        }
      }

      if (!matchedAction) return;

      e.preventDefault();
      e.stopPropagation();

      // Record for status bar indicator
      recordEvent(pressedKey);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      activeTimerRef.current = setTimeout(() => clearActive(), 500);

      if (mode === "internal") {
        handleInternalAction(matchedAction);
      } else {
        handleExternalAction(matchedAction);
      }
    };

    // Capture phase: higher priority than useKeyboard
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    };
  }, [enabled, config.enabled, recordEvent, clearActive, handleInternalAction, handleExternalAction]);
}
