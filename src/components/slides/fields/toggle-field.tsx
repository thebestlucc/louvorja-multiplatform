import { cn } from "../../../lib/utils";

export function ToggleField({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
        checked ? "border-primary bg-primary/10 text-foreground" : "border-border bg-transparent text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className={cn("text-base font-semibold", checked ? "text-primary" : "text-muted-foreground")}>
        {checked ? "●" : "○"}
      </span>
    </button>
  );
}
