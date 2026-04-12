import { cn } from "@/lib/utils";
import { useLongPress } from "@/hooks/use-long-press";
import { type ButtonHTMLAttributes, forwardRef, useRef, useEffect } from "react";

export interface LongPressButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  className?: string;
  /** Fires after holding for `duration` ms. */
  onHoldComplete: () => void;
  /** Hold duration in ms (default 600). */
  duration?: number;
  /** Whether to show the circular progress ring. */
  showProgress?: boolean;
}

export const LongPressButton = forwardRef<HTMLButtonElement, LongPressButtonProps>(
  (
    {
      className,
      onHoldComplete,
      duration = 600,
      showProgress = true,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const circleRef = useRef<SVGCircleElement | null>(null);
    const animRef = useRef<Animation | null>(null);

    const handlers = useLongPress({
      onHoldComplete,
      duration,
    });

    const startAnimation = () => {
      if (!showProgress || !circleRef.current) return;
      const circle = circleRef.current;
      const circumference = 2 * Math.PI * 20; // r=20
      circle.style.strokeDasharray = `${circumference}`;
      animRef.current = circle.animate(
        [
          { strokeDashoffset: `${circumference}` },
          { strokeDashoffset: "0" },
        ],
        { duration, fill: "forwards", easing: "linear" },
      );
    };

    const cancelAnimation = () => {
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
    };

    // Cleanup on unmount
    useEffect(() => cancelAnimation, []);

    return (
      <button
        ref={ref}
        role="button"
        disabled={disabled}
        className={cn(
          "relative inline-flex items-center justify-center rounded-xl",
          "text-fg bg-surface-1 hover:bg-surface-2",
          "transition-colors duration-[120ms]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "disabled:opacity-50 disabled:pointer-events-none select-none",
          "h-14 min-w-14 px-4 gap-2",
          className,
        )}
        {...props}
        onPointerDown={(e) => {
          if (disabled) return;
          startAnimation();
          handlers.onPointerDown(e);
        }}
        onPointerUp={(e) => {
          cancelAnimation();
          handlers.onPointerUp(e);
        }}
        onPointerLeave={(e) => {
          cancelAnimation();
          handlers.onPointerLeave(e);
        }}
        onPointerCancel={(e) => {
          cancelAnimation();
          handlers.onPointerCancel(e);
        }}
      >
        {showProgress && (
          <svg
            className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <circle
              ref={circleRef}
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDashoffset="999"
              className="text-primary opacity-70"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
LongPressButton.displayName = "LongPressButton";
