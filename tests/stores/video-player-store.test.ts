import { test, describe, beforeEach } from "node:test";
import * as assert from "node:assert";

// Stub Tauri IPC so plugin-store calls don't throw in Node
(globalThis as any).window = { __TAURI_INTERNALS__: { invoke: () => Promise.resolve(null) } };

import { useVideoPlayerStore } from "../../src/stores/video-player-store";

describe("videoPlayerStore", () => {
  beforeEach(() => {
    useVideoPlayerStore.getState().resetVideoState();
    useVideoPlayerStore.getState().setUseRustVideoPipeline(false);
  });

  test("initial state", () => {
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 0);
    assert.strictEqual(s.duration, 0);
    assert.strictEqual(s.paused, true);
    assert.strictEqual(s.volume, 1);
    assert.strictEqual(s.videoId, null);
    assert.strictEqual(s.videoSrc, null);
    assert.strictEqual(s.videoSource, null);
  });

  test("setVideoState updates partial fields", () => {
    useVideoPlayerStore.getState().resetVideoState();
    useVideoPlayerStore.getState().setVideoState({ currentTime: 42, paused: false, videoId: "abc123", videoSource: "youtube" });
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 42);
    assert.strictEqual(s.paused, false);
    assert.strictEqual(s.videoId, "abc123");
    assert.strictEqual(s.videoSource, "youtube");
    assert.strictEqual(s.videoSrc, null); // unchanged
  });

  test("resetVideoState restores initial state", () => {
    useVideoPlayerStore.getState().setVideoState({ currentTime: 99, videoId: "xyz", videoSource: "local" });
    useVideoPlayerStore.getState().resetVideoState();
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 0);
    assert.strictEqual(s.duration, 0);
    assert.strictEqual(s.paused, true);
    assert.strictEqual(s.volume, 1);
    assert.strictEqual(s.videoId, null);
    assert.strictEqual(s.videoSrc, null);
    assert.strictEqual(s.videoSource, null);
  });

  test("useRustVideoPipeline defaults to false", () => {
    assert.strictEqual(useVideoPlayerStore.getState().useRustVideoPipeline, false);
  });

  test("setUseRustVideoPipeline(true) updates state", () => {
    useVideoPlayerStore.getState().setUseRustVideoPipeline(true);
    assert.strictEqual(useVideoPlayerStore.getState().useRustVideoPipeline, true);
  });

  test("setUseRustVideoPipeline(false) resets to false", () => {
    useVideoPlayerStore.getState().setUseRustVideoPipeline(true);
    useVideoPlayerStore.getState().setUseRustVideoPipeline(false);
    assert.strictEqual(useVideoPlayerStore.getState().useRustVideoPipeline, false);
  });
});
