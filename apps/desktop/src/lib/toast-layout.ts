export const COLLAPSED_TOAST_LIMIT = 3;

export interface ToasterLayout {
  expand: boolean;
  visibleToasts: number;
}

export function getToasterLayout(toastCount: number, isInteracting: boolean): ToasterLayout {
  const safeToastCount = Math.max(0, Math.trunc(toastCount));

  if (safeToastCount <= COLLAPSED_TOAST_LIMIT) {
    return {
      expand: true,
      visibleToasts: COLLAPSED_TOAST_LIMIT,
    };
  }

  return {
    expand: isInteracting,
    visibleToasts: isInteracting ? safeToastCount : COLLAPSED_TOAST_LIMIT,
  };
}
