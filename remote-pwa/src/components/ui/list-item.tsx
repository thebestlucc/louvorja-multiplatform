import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface ListItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  /** Leading icon or avatar. */
  leading?: React.ReactNode;
  /** Trailing element (badge, chevron, etc.). */
  trailing?: React.ReactNode;
  /** Primary label. */
  label: string;
  /** Optional secondary label. */
  sublabel?: string;
}

export const ListItem = forwardRef<HTMLButtonElement, ListItemProps>(
  ({ className, leading, trailing, label, sublabel, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 w-full text-left",
        "min-h-[56px] px-4 py-3",
        "rounded-lg transition-colors duration-[120ms]",
        "hover:bg-surface-2 active:bg-surface-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      {leading && (
        <span className="flex-shrink-0 flex items-center justify-center" aria-hidden="true">
          {leading}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-fg truncate">{label}</span>
        {sublabel && (
          <span className="block text-xs text-fg-muted truncate mt-0.5">{sublabel}</span>
        )}
      </span>
      {trailing && (
        <span className="flex-shrink-0 flex items-center" aria-hidden="true">
          {trailing}
        </span>
      )}
    </button>
  ),
);
ListItem.displayName = "ListItem";
