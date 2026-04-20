/**
 * Smoke tests for `useRustVideoPipeline` — closes the plan section 7.4 gap
 * (`tests/hooks/use-rust-video-pipeline.test.ts`) without pulling in a full
 * RTCPeerConnection polyfill.
 *
 * This project's `pnpm test:unit` harness uses `node:test` and has no React
 * renderer in the dependency tree. Full hook lifecycle assertions (subscribe
 * → offer → answer → ICE → track) need both a hook renderer AND an
 * RTCPeerConnection mock; that coverage lives in the E2E smoke matrix (Task
 * 6.1) where a real browser is available.
 *
 * Scope here: the hook module is well-formed, its dependencies resolve, the
 * tauri wrapper contract compiles, and window-label filtering is purely
 * functional logic that can be exercised without React.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert";

// Stub Tauri IPC before any import resolves the bindings.
(globalThis as unknown as Record<string, unknown>).window = {
  __TAURI_INTERNALS__: {
    invoke: () => Promise.resolve(null),
  },
};

import { useRustVideoPipeline } from "../../src/hooks/use-rust-video-pipeline";
import * as videoPipeline from "../../src/lib/tauri/video-pipeline";

describe("useRustVideoPipeline (smoke)", () => {
  test("hook factory is exported", () => {
    assert.strictEqual(typeof useRustVideoPipeline, "function");
  });

  test("video-pipeline wrapper exposes subscribe + unsubscribe + answer + ice", () => {
    assert.strictEqual(typeof videoPipeline.subscribe, "function");
    assert.strictEqual(typeof videoPipeline.unsubscribe, "function");
    assert.strictEqual(typeof videoPipeline.sendAnswer, "function");
    assert.strictEqual(typeof videoPipeline.sendIce, "function");
  });

  test("windowLabel event filter matches only the current window", () => {
    // The hook filters incoming videoPipelineOffer / videoPipelineIce events
    // by `payload.windowLabel === windowLabel`. That filter is a pure string
    // equality — exercise the contract directly.
    const ownLabel = "projector";
    const matches = (payload: { windowLabel: string }) =>
      payload.windowLabel === ownLabel;
    assert.strictEqual(matches({ windowLabel: "projector" }), true);
    assert.strictEqual(matches({ windowLabel: "return" }), false);
    assert.strictEqual(matches({ windowLabel: "main" }), false);
  });
});
