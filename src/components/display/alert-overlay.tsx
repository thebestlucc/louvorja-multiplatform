import { useMemo } from "react";
import { AlertState } from "../../lib/bindings";
import { cn } from "../../lib/utils";

interface AlertOverlayProps {
  alert: AlertState | null;
  className?: string;
  fontSize?: string;
}

export function AlertOverlay({ alert, className, fontSize = "2.5vw" }: AlertOverlayProps) {
  const isVisible = alert?.isVisible && alert?.text;

  const animationDuration = useMemo(() => {
    if (!alert?.text) return "15s";
    // Approx 15s for average length, faster/slower based on length
    const duration = Math.max(10, Math.min(60, alert.text.length / 5));
    return `${duration}s`;
  }, [alert?.text]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 bottom-0 z-[100] bg-black/80 text-white font-bold px-[4vw] py-[1.5vh] overflow-hidden whitespace-nowrap border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]",
        className
      )}
      style={{ fontSize }}
    >
      <div
        className={cn(
          "inline-block",
          alert.isTicker && "animate-alert-marquee pl-[100%]"
        )}
        style={alert.isTicker ? { animationDuration } : {}}
      >
        {alert.text}
      </div>

      <style>{`
        @keyframes alert-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .animate-alert-marquee {
          animation-name: alert-marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
