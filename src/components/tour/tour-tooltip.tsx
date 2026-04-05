import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TourStep } from "../../lib/onboarding";

interface TooltipPosition {
  top: number;
  left: number;
}

interface TourTooltipProps {
  step: TourStep;
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onSkip: () => void;
}

export function TourTooltip({ step, title, description, currentStep, totalSteps, targetRect, onNext, onSkip }: TourTooltipProps) {
  const { t } = useTranslation();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case "bottom":
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case "top":
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.right + gap;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.left - tooltipRect.width - gap;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

    setPosition({ top, left });
  }, [step, targetRect]);

  const isLast = currentStep === totalSteps - 1;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[10001] w-72 rounded-xl border border-border bg-popover p-4 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex gap-2">
          {!isLast && (
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("common.skip")}
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {isLast ? t("common.done") : t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
