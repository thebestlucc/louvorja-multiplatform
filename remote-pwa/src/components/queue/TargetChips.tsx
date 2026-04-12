import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Target = "projector" | "return";

interface TargetChipsProps {
  targets: Target[];
  onChange: (targets: Target[]) => void;
  className?: string;
}

const ALL_TARGETS: Target[] = ["projector", "return"];

export function TargetChips({ targets, onChange, className }: TargetChipsProps) {
  const { t } = useTranslation();

  function toggle(target: Target) {
    const isActive = targets.includes(target);
    if (isActive) {
      onChange(targets.filter((t) => t !== target));
    } else {
      onChange([...targets, target]);
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {ALL_TARGETS.map((target) => {
        const checked = targets.includes(target);
        const label = target === "projector" ? t("remote.queue.target_projector") : t("remote.queue.target_return");
        return (
          <label
            key={target}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer",
              "transition-colors select-none",
              checked
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-1 border-border text-fg-muted hover:text-fg",
            )}
          >
            <input
              type="checkbox"
              role="checkbox"
              aria-label={label}
              checked={checked}
              onChange={() => toggle(target)}
              className="sr-only"
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}
