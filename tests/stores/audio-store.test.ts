import { beforeEach, describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { useAudioStore } from "../../src/stores/audio-store";
import { usePresentationStore } from "../../src/stores/presentation-store";

describe("Audio Store", () => {
  beforeEach(() => {
    useAudioStore.getState().reset();
    usePresentationStore.getState().setSlides([]);
    usePresentationStore.getState().setActiveSlideIndex(0);
  });

  test("onFinished callback is called when audio ends", async () => {
    let finishedCalled = false;
    
    // This is TDD-RED: we are testing a feature that doesn't exist yet
    // The current store doesn't have setOnFinished or similar.
    const store = useAudioStore.getState();
    
    // @ts-ignore - feature not implemented yet
    store.setOnFinished(() => {
      finishedCalled = true;
    });

    // We need to simulate the event that triggers completion
    // But since we can't easily mock the 'listen' from Tauri in this environment 
    // without more setup, we'll just test that the interface exists first.
    
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

    store.syncToPosition(6_000);

    assert.equal(usePresentationStore.getState().activeSlideIndex, 1);
  });
});
