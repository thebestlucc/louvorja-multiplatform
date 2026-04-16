import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface PinInputProps {
  /** Number of digit boxes (default 6) */
  length?: number;
  /** Controlled value — a string of digits */
  value?: string;
  /** Called on every digit change */
  onChange?: (value: string) => void;
  /** Called when all digits are entered */
  onSubmit?: (value: string) => void;
  /** Disable all inputs */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * PIN input component with N individual digit boxes.
 * Features: auto-advance, backspace navigation, paste support, ARIA labels.
 */
export function PinInput({
  length = 6,
  value: controlledValue,
  onChange,
  onSubmit,
  disabled = false,
  className,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState("");

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Ensure value is the right length
  const paddedValue = value.padEnd(length, "").slice(0, length);

  // Ensure refs array is the right length
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
    while (inputRefs.current.length < length) {
      inputRefs.current.push(null);
    }
  }, [length]);

  const setValue = useCallback(
    (val: string) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(val);
      if (val.length === length) {
        onSubmit?.(val);
      }
    },
    [length, isControlled, onChange, onSubmit],
  );

  const handleChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Only allow single digit, numeric
      const digit = raw.replace(/[^0-9]/g, "");
      if (!digit && raw === "") {
        // Empty change — ignore
        return;
      }
      if (!digit) {
        // Non-numeric character entered — ignore, don't advance
        return;
      }

      const prev = paddedValue;
      const next = prev.substring(0, index) + digit + prev.substring(index + 1);
      setValue(next);

      // Auto-advance to next box
      const nextIndex = index + 1;
      if (nextIndex < length && inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex].focus();
      }
    },
    [length, paddedValue, setValue],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const prev = paddedValue;
        if (prev[index]) {
          // Clear current box
          const next = prev.substring(0, index) + prev.substring(index + 1);
          setValue(next);
        } else if (index > 0 && inputRefs.current[index - 1]) {
          // Move to previous box and clear it
          inputRefs.current[index - 1]!.focus();
          const cleared = prev.substring(0, index - 1) + prev.substring(index);
          setValue(cleared);
        }
      }
    },
    [paddedValue, setValue],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length);
      if (!pasted) return;

      setValue(pasted);

      // Focus the last filled box or the next empty one
      const focusIndex = Math.min(pasted.length, length - 1);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex].focus();
      }
    },
    [length, setValue],
  );

  return (
    <div className={cn("flex justify-center gap-2", className)} role="group" aria-label="PIN input">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={paddedValue[i] ?? ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={cn(
            "w-16 h-[72px] text-center text-2xl font-semibold tracking-wider",
            "rounded-lg border border-border bg-surface-1 text-fg",
            "focus:outline-none focus:ring-2 focus:ring-primary",
            "disabled:opacity-50 disabled:pointer-events-none",
            "transition-colors",
          )}
        />
      ))}
    </div>
  );
}
