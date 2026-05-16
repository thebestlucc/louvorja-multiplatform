import { cn } from "../../lib/utils";
import { THEMES, LANGUAGES, type Theme, type Language } from "../../lib/constants";

export function ToggleButton({
  checked,
  onClick,
  ariaLabel,
}: {
  checked: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export function isTheme(value: string): value is Theme {
  return THEMES.includes(value as Theme);
}

export function isLanguage(value: string): value is Language {
  return LANGUAGES.includes(value as Language);
}
