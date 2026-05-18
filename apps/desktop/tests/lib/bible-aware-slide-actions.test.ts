/**
 * Locks in the bible-aware dispatch fix.
 *
 * Bug: while bible projection is active, ArrowLeft/Right at /playing-now used
 * `actions.nextSlide` (media-player path) instead of `navigate_bible`. After a
 * freeze→unfreeze cycle the inconsistency surfaced as "navigation disabled".
 * Fix: wrap actions so prev/next route to navigate_bible when bible projection
 * is active. This test pins the dispatch.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert";

import { wrapBibleAwareSlideActions } from "../../src/lib/bible-aware-slide-actions";

function makeBaseActions() {
  const calls: string[] = [];
  return {
    calls,
    actions: {
      prevSlide: () => { calls.push("media:prev"); },
      nextSlide: () => { calls.push("media:next"); },
      extra: "preserved",
    },
  };
}

function makeNavigateBibleStub() {
  const calls: string[] = [];
  return {
    calls,
    navigateBible: async (direction: "next" | "prev") => {
      calls.push(`bible:${direction}`);
    },
  };
}

describe("wrapBibleAwareSlideActions", () => {
  test("returns original actions when bible projection is inactive", () => {
    const { actions, calls } = makeBaseActions();
    const { navigateBible, calls: bibleCalls } = makeNavigateBibleStub();

    const wrapped = wrapBibleAwareSlideActions(actions, false, navigateBible);

    wrapped.prevSlide();
    wrapped.nextSlide();

    assert.deepStrictEqual(calls, ["media:prev", "media:next"]);
    assert.deepStrictEqual(bibleCalls, []);
    // Reference equality short-circuit when not bible (cheap render).
    assert.strictEqual(wrapped, actions);
  });

  test("routes prev/next to navigateBible when bible projection is active", async () => {
    const { actions, calls } = makeBaseActions();
    const { navigateBible, calls: bibleCalls } = makeNavigateBibleStub();

    const wrapped = wrapBibleAwareSlideActions(actions, true, navigateBible);

    wrapped.prevSlide();
    wrapped.nextSlide();

    // The wrapped handlers fire-and-forget the navigateBible promise; yield
    // to the microtask queue so the stub records the calls.
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepStrictEqual(calls, [], "media-player path must not fire");
    assert.deepStrictEqual(bibleCalls, ["bible:prev", "bible:next"]);
  });

  test("preserves other action properties when wrapping for bible", () => {
    const { actions } = makeBaseActions();
    const { navigateBible } = makeNavigateBibleStub();

    const wrapped = wrapBibleAwareSlideActions(actions, true, navigateBible);

    assert.strictEqual(wrapped.extra, "preserved");
  });

  test("swallows navigateBible rejection without throwing", async () => {
    const { actions } = makeBaseActions();
    const navigateBible = async (_direction: "next" | "prev") => {
      throw new Error("simulated IPC failure");
    };

    const wrapped = wrapBibleAwareSlideActions(actions, true, navigateBible);

    // Must not throw synchronously and must not surface an unhandled rejection.
    assert.doesNotThrow(() => wrapped.nextSlide());
    assert.doesNotThrow(() => wrapped.prevSlide());

    // Drain microtasks so the .catch attaches before assertion completes.
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
});
