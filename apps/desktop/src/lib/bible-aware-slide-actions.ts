/**
 * When bible projection is active, prev/next slide must route through
 * `navigateBible` (split-aware Rust command that mutates `bp.context`).
 * Wrap an existing media-player action set so keyboard arrows + control
 * buttons share the same dispatch.
 */
export interface SlideActionPair {
  prevSlide: () => void;
  nextSlide: () => void;
}

export function wrapBibleAwareSlideActions<T extends SlideActionPair>(
  actions: T,
  isBibleProjection: boolean,
  navigateBible: (direction: "next" | "prev") => Promise<void>,
): T {
  if (!isBibleProjection) return actions;
  return {
    ...actions,
    prevSlide: () => { navigateBible("prev").catch(() => {}); },
    nextSlide: () => { navigateBible("next").catch(() => {}); },
  };
}
