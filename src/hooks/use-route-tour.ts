import { useState, useEffect, useCallback } from "react";
import { ROUTE_TOURS, isRouteTourCompleted, completeRouteTour, type TourStep } from "../lib/tour";

export function useRouteTour(routePath: string) {
  const [showTour, setShowTour] = useState(false);
  const steps: TourStep[] = ROUTE_TOURS[routePath] ?? [];

  useEffect(() => {
    if (!steps.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void isRouteTourCompleted(routePath).then((completed) => {
      if (!completed && !cancelled) {
        timer = setTimeout(() => setShowTour(true), 1000);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [routePath, steps.length]);

  const handleComplete = useCallback(async () => {
    setShowTour(false);
    await completeRouteTour(routePath);
  }, [routePath]);

  const handleSkip = handleComplete;

  return { showTour, setShowTour, steps, handleComplete, handleSkip };
}
