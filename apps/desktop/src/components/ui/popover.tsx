import { useRef, useEffect, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Popover({ open, onOpenChange, children }: PopoverProps) {
  return (
    <div className="relative inline-flex">
      {children}
      {/* Close on escape */}
      {open && (
        <PopoverEscapeHandler onClose={() => onOpenChange(false)} />
      )}
    </div>
  );
}

function PopoverEscapeHandler({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return null;
}

interface PopoverTriggerProps {
  children: ReactNode;
  asChild?: boolean;
  onClick?: () => void;
}

export function PopoverTrigger({ children, onClick }: PopoverTriggerProps) {
  return (
    <button type="button" onClick={onClick} className="inline-flex">
      {children}
    </button>
  );
}

interface PopoverContentProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  onClose: () => void;
}

export function PopoverContent({ children, className, align = "start", onClose }: PopoverContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Check if the click target is within the parent popover (trigger)
        const parent = ref.current.closest(".relative.inline-flex");
        if (parent && parent.contains(e.target as Node)) return;
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-full z-50 mt-1 rounded-lg border border-border bg-surface shadow-lg",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
