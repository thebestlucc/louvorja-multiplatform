import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearCurrentSlide,
  getCurrentSlide,
  getSlideContext,
  setCurrentSlide,
  setSlideContext,
} from "../lib/tauri";
import { useDisplayStore } from "../stores/display-store";
import type {
  UtilityProjectionKind,
  UtilityProjectionPayload,
  UtilityProjectionState,
} from "../types/utilities";
import type { SlideContentFlat, SlideContextFlat } from "../types/presentation";

interface ProjectionSnapshot {
  slide: SlideContentFlat | null;
  context: SlideContextFlat | null;
  projectionType: "bible" | "hymn" | "presentation" | "utility" | "service" | null;
}

export function useUtilityProjection(kind: UtilityProjectionKind) {
  const snapshotRef = useRef<ProjectionSnapshot | null>(null);
  const restoreInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const [state, setState] = useState<UtilityProjectionState>({
    isProjecting: false,
    projectedKind: null,
  });

  const captureSnapshot = useCallback(async () => {
    if (snapshotRef.current) {
      return;
    }

    const [slide, context] = await Promise.all([
      getCurrentSlide(),
      getSlideContext(),
    ]);

    const displayState = useDisplayStore.getState();
    snapshotRef.current = {
      slide,
      context,
      projectionType: displayState.currentProjectionType,
    };
  }, []);

  const project = useCallback(async (payload: UtilityProjectionPayload) => {
    await captureSnapshot();
    await setCurrentSlide(payload.slide);
    await setSlideContext(payload.context);
    useDisplayStore.getState().setCurrentProjectionType("utility");

    if (!isMountedRef.current) {
      return;
    }

    setState((current) => {
      if (current.isProjecting && current.projectedKind === kind) {
        return current;
      }
      return {
        isProjecting: true,
        projectedKind: kind,
      };
    });
  }, [captureSnapshot, kind]);

  const restoreSnapshot = useCallback(async () => {
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;

    if (!snapshot) {
      await clearCurrentSlide();
      useDisplayStore.getState().setCurrentProjectionType(null);
      return;
    }

    if (!snapshot.slide) {
      await clearCurrentSlide();
      useDisplayStore.getState().setCurrentProjectionType(null);
      return;
    }

    if (!snapshot.context) {
      await clearCurrentSlide();
      await setCurrentSlide(snapshot.slide);
      useDisplayStore.getState().setCurrentProjectionType(snapshot.projectionType);
      return;
    }

    await Promise.all([
      setCurrentSlide(snapshot.slide),
      setSlideContext(snapshot.context),
    ]);
    useDisplayStore.getState().setCurrentProjectionType(snapshot.projectionType);
  }, []);

  const stopProjection = useCallback(async () => {
    if (restoreInFlightRef.current) {
      return;
    }

    restoreInFlightRef.current = true;
    try {
      await restoreSnapshot();
    } finally {
      if (isMountedRef.current) {
        setState((current) => {
          if (!current.isProjecting && current.projectedKind == null) {
            return current;
          }
          return {
            isProjecting: false,
            projectedKind: null,
          };
        });
      }
      restoreInFlightRef.current = false;
    }
  }, [restoreSnapshot]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (snapshotRef.current) {
        void stopProjection();
      }
    };
  }, [stopProjection]);

  return {
    ...state,
    startProjection: project,
    stopProjection,
  };
}
