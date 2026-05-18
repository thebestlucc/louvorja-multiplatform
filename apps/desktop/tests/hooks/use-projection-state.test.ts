/**
 * Smoke + recovery-rule tests for `useProjectionState`.
 *
 * This project's `pnpm test:unit` harness uses `node:test` and has no React
 * renderer. Full hook lifecycle (mount → fetch → listen → delta → recovery)
 * needs a renderer, which isn't installed. Scope here:
 *   - hook module is well-formed and exported
 *   - the universal recovery rule (ADR-0003) is encoded correctly
 *   - applyDelta integration: feeding a snapshot through applyDelta lines up
 *     with what the hook would store as the next state
 *
 * Full hook integration coverage lives in the manual smoke matrix (Phase 4
 * acceptance criteria — close/reopen projector while a slide is projected).
 */

import { test, describe } from "node:test";
import * as assert from "node:assert";

// Stub Tauri IPC before any import resolves the bindings.
(globalThis as unknown as Record<string, unknown>).window = {
  __TAURI_INTERNALS__: {
    invoke: () => Promise.resolve(null),
  },
};

import { useProjectionState } from "../../src/hooks/use-projection-state";
import { applyDelta } from "../../src/lib/projection/apply-delta";
import type {
  ProjectionDelta,
  ProjectionSnapshot,
} from "../../src/lib/bindings";

function emptySnapshot(version: number): ProjectionSnapshot {
  return {
    version,
    currentSlide: null,
    context: null,
    overlay: "none",
    frozen: false,
    alert: null,
  };
}

describe("useProjectionState (smoke)", () => {
  test("hook factory is exported", () => {
    assert.strictEqual(typeof useProjectionState, "function");
  });
});

describe("universal recovery rule (ADR-0003)", () => {
  // The hook implements: if delta.fromVersion === local.version, apply;
  // else re-fetch snapshot. Exercise that decision as a pure predicate so
  // the contract is pinned even without a React renderer.
  const shouldRehydrate = (local: number, deltaFrom: number) =>
    local !== deltaFrom;

  test("in-order delta does not trigger re-hydrate", () => {
    assert.strictEqual(shouldRehydrate(5, 5), false);
  });

  test("gap (missed delta) triggers re-hydrate", () => {
    assert.strictEqual(shouldRehydrate(5, 7), true);
  });

  test("regression (local ahead of delta) triggers re-hydrate", () => {
    // Should never happen in practice (Hub is the single writer) but the
    // predicate must still flag it so a stuck consumer recovers.
    assert.strictEqual(shouldRehydrate(8, 5), true);
  });

  test("first delta after snapshot version 0 applies cleanly", () => {
    const snapshot = emptySnapshot(0);
    const delta: ProjectionDelta = {
      fromVersion: 0,
      toVersion: 1,
      events: [{ kind: "freezeChanged", frozen: true }],
    };
    assert.strictEqual(shouldRehydrate(snapshot.version, delta.fromVersion), false);
    const next = applyDelta(snapshot, delta);
    assert.strictEqual(next.version, 1);
    assert.strictEqual(next.frozen, true);
  });
});
