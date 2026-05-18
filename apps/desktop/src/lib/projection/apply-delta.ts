import type {
  ProjectionDelta,
  ProjectionSnapshot,
  OverlayMode,
} from "../bindings";

/**
 * Apply a Delta to a Snapshot, returning a NEW Snapshot. Pure: never mutates
 * the input. Mirrors the Hub's mutation semantics one-for-one — the
 * `delta.toVersion` becomes the new snapshot version and each event in
 * `delta.events` overwrites its corresponding field.
 *
 * Caller is responsible for the universal recovery rule (ADR-0003):
 * `delta.fromVersion !== snapshot.version → re-hydrate via get_projection_snapshot`.
 */
export function applyDelta(
  snapshot: ProjectionSnapshot,
  delta: ProjectionDelta,
): ProjectionSnapshot {
  const next: ProjectionSnapshot = { ...snapshot, version: delta.toVersion };
  for (const event of delta.events) {
    switch (event.kind) {
      case "slideChanged":
        next.currentSlide = event.slide;
        break;
      case "contextChanged":
        next.context = event.context;
        break;
      case "overlayChanged":
        next.overlay = event.overlay;
        break;
      case "freezeChanged":
        next.frozen = event.frozen;
        break;
      case "alertChanged":
        next.alert = event.alert;
        break;
      default: {
        // Exhaustiveness check: a future Rust DeltaEvent variant must land
        // in `bindings.ts` AND trigger a TS compile error here.
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }
  return next;
}

/**
 * Map the OverlayMode enum to the (blackScreen, logoScreen) boolean pair that
 * existing render code reads. Phase 5 deletes the boolean view; for Phase 4 we
 * keep both shapes alive so the migration is a per-file swap.
 */
export function overlayBools(mode: OverlayMode): {
  blackScreen: boolean;
  logoScreen: boolean;
} {
  return {
    blackScreen: mode === "black",
    logoScreen: mode === "logo",
  };
}
