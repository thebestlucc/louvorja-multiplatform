import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  /** Required accessible label for icon-only buttons. */
  "aria-label": string;
  /** Size variant: default 56px (primary action) or 48px (secondary). */
  size?: "default" | "sm";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        "text-fg hover:bg-surface-2 active:bg-surface-3",
        "transition-all duration-[120ms] active:scale-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:opacity-50 disabled:pointer-events-none select-none",
        size === "default" ? "h-14 w-14" : "h-12 w-12",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
