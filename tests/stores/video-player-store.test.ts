import { test, describe } from "node:test";
import * as assert from "node:assert";
import { useVideoPlayerStore } from "../../src/stores/video-player-store";

describe("videoPlayerStore", () => {
  test("initial state", () => {
    const s = useVideoPlayerStore.getState();
    assert.strictEqual(s.currentTime, 0);
    assert.strictEqual(s.duration, 0);
    assert.strictEqual(s.paused, true);
    assert.strictEqual(s.videoId, null);
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
    assert.strictEqual(s.videoId, null);
    assert.strictEqual(s.videoSource, null);
  });
});
