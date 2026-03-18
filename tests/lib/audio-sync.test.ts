import { describe, test } from "node:test";
import { strict as assert } from "node:assert";

import type { SyncPoint } from "../../src/lib/bindings";
import {
  findExactSlideTimestamp,
  findSlideAtPosition,
  getActiveTimestamp,
  resolveProgressRatio,
  resolveSlideTimingWindow,
  resolvePlaybackTargetFile,
  resolvePlaybackVariantPaths,
  resolvePlaybackSeekLockAction,
  resolvePlaybackModeSwitchPosition,
  resolveReplayStartPosition,
  resolveSlideSeekTimestamp,
} from "../../src/lib/audio-sync";

const syncPoints: SyncPoint[] = [
  { slideIndex: 0, timestampMs: 0, instrumentalTimestampMs: 0 },
  { slideIndex: 1, timestampMs: 1_000, instrumentalTimestampMs: 5_000 },
  { slideIndex: 2, timestampMs: 2_000, instrumentalTimestampMs: 9_000 },
];

describe("audio sync helper", () => {
  test("prefers instrumental timestamps in karaoke mode", () => {
    assert.equal(getActiveTimestamp(syncPoints[1], "karaoke"), 5_000);
  });

  test("finds the karaoke slide using instrumental timing", () => {
    assert.equal(findSlideAtPosition(syncPoints, 6_000, "karaoke"), 1);
  });

  test("resolves seek timestamp from the karaoke timeline", () => {
    assert.equal(resolveSlideSeekTimestamp(syncPoints, 2, "karaoke"), 9_000);
  });

  test("returns only exact timestamps when looking up a target slide", () => {
    assert.equal(findExactSlideTimestamp(syncPoints, 2, "karaoke"), 9_000);
    assert.equal(findExactSlideTimestamp(syncPoints, 9, "karaoke"), null);
  });

  test("calculates bounded progress inside a slide timing window", () => {
    assert.equal(resolveProgressRatio(2_000, 10_000, 6_000), 0.5);
    assert.equal(resolveProgressRatio(2_000, 10_000, 12_000), 1);
    assert.equal(resolveProgressRatio(2_000, 2_000, 6_000), null);
  });

  test("resolves a slide timing window using the next exact sync point", () => {
    assert.deepEqual(resolveSlideTimingWindow(syncPoints, 1, "karaoke"), {
      startMs: 5_000,
      endMs: 9_000,
    });
    assert.deepEqual(resolveSlideTimingWindow(syncPoints, 2, "karaoke"), {
      startMs: 9_000,
      endMs: null,
    });
  });

  test("does not create a fake timing target for the final empty lyric slide", () => {
    const finalGapSyncPoints: SyncPoint[] = [
      { slideIndex: 0, timestampMs: 0, instrumentalTimestampMs: 0 },
      { slideIndex: 1, timestampMs: 1_000, instrumentalTimestampMs: 5_000 },
    ];

    const timingWindow = resolveSlideTimingWindow(finalGapSyncPoints, 2, "karaoke");

    assert.deepEqual(timingWindow, {
      startMs: 5_000,
      endMs: null,
    });
    assert.equal(resolveProgressRatio(timingWindow.startMs, timingWindow.endMs, 8_000), null);
  });

  test("mode switches keep the current elapsed time instead of snapping to a sync point", () => {
    assert.equal(resolvePlaybackModeSwitchPosition(6_350), 6_350);
  });

  test("ignores stale play-start payloads until the requested playback position is reached", () => {
    assert.equal(
      resolvePlaybackSeekLockAction(0, { targetMs: 6_350, expiresAtMs: 10_000 }, 9_000),
      "ignore",
    );
  });

  test("releases the play-start lock when the audio payload catches up", () => {
    assert.equal(
      resolvePlaybackSeekLockAction(6_500, { targetMs: 6_350, expiresAtMs: 10_000 }, 9_000),
      "release",
    );
  });

  test("replay starts from zero when playback already reached the end", () => {
    assert.equal(resolveReplayStartPosition(10_100, 10_000), 0);
  });

  test("replay keeps the chosen position when restarting from the middle", () => {
    assert.equal(resolveReplayStartPosition(6_350, 10_000), 6_350);
  });

  test("resolves the active file path for karaoke mode with sung fallback", () => {
    assert.equal(
      resolvePlaybackTargetFile("karaoke", "media/hymns/sung.mp3", null),
      "media/hymns/sung.mp3",
    );
  });

  test("returns distinct variant paths only when both files exist", () => {
    assert.deepEqual(
      resolvePlaybackVariantPaths("media/hymns/sung.mp3", "media/hymns/karaoke.mp3"),
      {
        sungPath: "media/hymns/sung.mp3",
        karaokePath: "media/hymns/karaoke.mp3",
      },
    );
    assert.equal(
      resolvePlaybackVariantPaths("media/hymns/shared.mp3", "media/hymns/shared.mp3"),
      null,
    );
  });
});
