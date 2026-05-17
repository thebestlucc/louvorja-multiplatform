import { useCallback, useEffect, useRef } from "react";
import {
  clearCurrentSlide,
  setCurrentSlide,
  setSlideContext,
} from "../lib/tauri";
import { getProjectionSnapshot } from "../lib/tauri/display";
import { useDisplayStore } from "../stores/display-store";
import type { UtilityProjectionPayload, UtilityProjectionKind } from "../types/utilities";
import type { SlideContent, SlideContext } from "../lib/bindings";
import { catcher } from "../lib/catcher";
import { clearActivePlayback } from "../lib/projection-playback";

export function useUtilityProjection(_kind: UtilityProjectionKind) {
  const currentProjectionType = useDisplayStore((s) => s.currentProjectionType);
  const setCurrentProjectionType = useDisplayStore((s) => s.setCurrentProjectionType);
  const isMountedRef = useRef(true);

  // Take a snapshot of whatever was on the screen before we started projecting
  const snapshotRef = useRef<{
    slide: SlideContent | null;
    context: SlideContext | null;
  } | null>(null);

  const isProjecting = currentProjectionType === "utility";

  const project = useCallback(
    async (payload: UtilityProjectionPayload) => {
      if (!isProjecting) {
        await clearActivePlayback();
        const snap = await getProjectionSnapshot();
        snapshotRef.current = { slide: snap.currentSlide, context: snap.context };
        setCurrentProjectionType("utility");
      }

      await Promise.all([
        setCurrentSlide(payload.slide),
        setSlideContext(payload.context),
      ]);
    },
    [isProjecting, setCurrentProjectionType],
  );

  const stopProjection = useCallback(async () => {
    if (!isProjecting) return;

    await catcher(async () => {
      if (snapshotRef.current?.slide) {
        await setCurrentSlide(snapshotRef.current.slide);
        if (snapshotRef.current.context) {
          await setSlideContext(snapshotRef.current.context);
        }
      } else {
        await clearCurrentSlide();
      }
    });

    snapshotRef.current = null;
    if (isMountedRef.current) {
      setCurrentProjectionType(null);
    }
  }, [isProjecting, setCurrentProjectionType]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (snapshotRef.current) {
        stopProjection();
      }
    };
  }, [stopProjection]);

  return {
    isProjecting,
    startProjection: project,
    stopProjection,
  };
}
