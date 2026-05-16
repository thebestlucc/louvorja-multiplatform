import { beforeEach, describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { useAudioStore } from "../../src/stores/audio-store";
import { usePresentationStore } from "../../src/stores/presentation-store";
import { appEventBus } from "../../src/lib/event-bus";

describe("Audio Store", () => {
  beforeEach(() => {
    useAudioStore.getState().reset();
    usePresentationStore.getState().setActiveSlideIndex(0);
  });

  test("onFinished callback is called when audio ends", async () => {
    // TDD-RED: setOnFinished not yet implemented in store.
    const store = useAudioStore.getState();
    // @ts-ignore
    assert.strictEqual(typeof store.setOnFinished, "function", "setOnFinished should be a function");
  });

  test("syncToPosition uses instrumental timestamps in karaoke mode", () => {
    const store = useAudioStore.getState();

    store.setSyncPoints([
      { slideIndex: 0, timestampMs: 0, instrumentalTimestampMs: 0 },
      { slideIndex: 1, timestampMs: 1_000, instrumentalTimestampMs: 5_000 },
      { slideIndex: 2, timestampMs: 2_000, instrumentalTimestampMs: 9_000 },
    ]);
    store.setPlaybackMode("karaoke");

    const syncedSlides: number[] = [];
    const unsub = appEventBus.on("audio:slide-sync", ({ slideIndex }) => {
      syncedSlides.push(slideIndex);
    });

    store.syncToPosition(6_000);
    unsub();

    assert.ok(syncedSlides.includes(1), `expected slideIndex 1, got [${syncedSlides.join(", ")}]`);
  });
});
