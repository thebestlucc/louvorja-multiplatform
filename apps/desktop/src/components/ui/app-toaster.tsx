import { useEffect, useState } from "react";
import { Toaster, useSonner } from "sonner";
import { getToasterLayout } from "../../lib/toast-layout";

const TOASTER_SELECTOR = "[data-sonner-toaster]";
const TOASTER_TOAST_CLASSNAME = "z-[120] bg-surface text-foreground border-border";

function isWithinToaster(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TOASTER_SELECTOR) !== null;
}

export function AppToaster() {
  const { toasts } = useSonner();
  const [isInteracting, setIsInteracting] = useState(false);
  const activeToastCount = toasts.filter((toast) => !toast.delete).length;
  const { expand, visibleToasts } = getToasterLayout(activeToastCount, isInteracting);

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent) => {
      if (isWithinToaster(event.target)) {
        setIsInteracting(true);
      }
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (!isWithinToaster(event.target)) {
        return;
      }
      if (isWithinToaster(event.relatedTarget)) {
        return;
      }
      setIsInteracting(false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isWithinToaster(event.target)) {
        setIsInteracting(true);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!isWithinToaster(event.target)) {
        return;
      }
      if (isWithinToaster(event.relatedTarget)) {
        return;
      }
      setIsInteracting(false);
    };

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <Toaster
      position="bottom-right"
      expand={expand}
      visibleToasts={visibleToasts}
      toastOptions={{
        className: TOASTER_TOAST_CLASSNAME,
      }}
    />
  );
}
