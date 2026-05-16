import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface BottomTabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

export const BottomTab = forwardRef<HTMLButtonElement, BottomTabProps>(
  ({ className, icon, label, active = false, ...props }, ref) => (
    <button
      ref={ref}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex flex-col items-center justify-center gap-1",
        "flex-1 min-h-[56px] py-2 px-1",
        "text-xs font-medium transition-colors duration-[120ms]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        active ? "text-primary" : "text-fg-muted hover:text-fg",
        className,
      )}
      {...props}
    >
      <span className="h-6 w-6 flex items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  ),
);
BottomTab.displayName = "BottomTab";
