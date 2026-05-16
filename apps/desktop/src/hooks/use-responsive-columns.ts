import { useMemo } from "react";
import { useWindowSize } from "react-use";

/** Responsive grid class — breakpoints must match useResponsiveColumns. */
export const GRID_COLS_CLASS = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export function useResponsiveColumns(view: "list" | "grid"): number {
  const { width = 1280 } = useWindowSize();
  return useMemo(() => {
    if (view === "list") return 1;
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 768) return 4;
    if (width >= 640) return 3;
    return 2;
  }, [view, width]);
}
