import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium text-sm rounded-lg",
    "transition-all duration-[120ms]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    "disabled:opacity-50 disabled:pointer-events-none",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-fg hover:bg-primary-hover active:scale-95",
        secondary:
          "bg-surface-2 text-fg hover:bg-surface-3 active:scale-95",
        ghost:
          "text-fg hover:bg-surface-2 active:bg-surface-3 active:scale-95",
        destructive:
          "bg-destructive text-destructive-fg hover:bg-destructive-hover active:scale-95",
        outline:
          "border border-border-muted text-fg hover:bg-surface-2 active:scale-95",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-14 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
