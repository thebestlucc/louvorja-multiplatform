import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { TOUR_STEPS, finishTour, type TourStep } from "../../lib/tour";
import { TourTooltip } from "./tour-tooltip";

interface SpotlightTourProps {
  onComplete: () => void;
  onSkip?: () => void;
  /** Custom steps override. Falls back to the global TOUR_STEPS when omitted. */
  steps?: TourStep[];
}

interface CutoutRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SpotlightTour({ onComplete, onSkip: onSkipProp, steps: stepsProp }: SpotlightTourProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cutout, setCutout] = useState<CutoutRect | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const steps = stepsProp ?? TOUR_STEPS;
  const step = steps[currentIndex];
  const isFinishStep = !stepsProp && step?.i18nKey === "tour.finish";

  // Update cutout position when step changes
  useEffect(() => {
    if (!step || isFinishStep) {
      setCutout(null);
      return;
    }
    const target = document.querySelector(step.target);
    if (!target) {
      setCutout(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setTargetRect(rect);
    const padding = 8;
    setCutout({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });
  }, [step, isFinishStep]);

  const handleComplete = useCallback(async () => {
    if (!stepsProp) {
      await finishTour();
    }
    onComplete();
  }, [onComplete, stepsProp]);

  const handleNext = useCallback(() => {
    if (currentIndex >= steps.length - 1) {
      void handleComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, steps.length, handleComplete]);

  const handleSkip = useCallback(() => {
    if (onSkipProp) {
      onSkipProp();
    } else {
      void handleComplete();
    }
  }, [handleComplete, onSkipProp]);

  if (!step) return null;

  const backdropStyle = cutout
    ? {
        clipPath: `polygon(
          0% 0%, 0% 100%, ${cutout.left}px 100%, ${cutout.left}px ${cutout.top}px,
          ${cutout.left + cutout.width}px ${cutout.top}px, ${cutout.left + cutout.width}px ${cutout.top + cutout.height}px,
          ${cutout.left}px ${cutout.top + cutout.height}px, ${cutout.left}px 100%, 100% 100%, 100% 0%
        )`,
      }
    : {};

  return createPortal(
    <>
      {/* Backdrop with cutout */}
      <div
        className="fixed inset-0 z-[10000] bg-black/50 transition-all duration-300"
        style={backdropStyle}
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <TourTooltip
        step={step}
        title={t(`${step.i18nKey}.title`)}
        description={t(`${step.i18nKey}.description`)}
        currentStep={currentIndex}
        totalSteps={steps.length}
        targetRect={targetRect}
        onNext={handleNext}
        onSkip={handleSkip}
      />
    </>,
    document.body,
  );
}
