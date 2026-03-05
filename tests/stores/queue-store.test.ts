import { test, describe } from "node:test";
import * as assert from "node:assert";
import { useQueueStore } from "../../src/stores/queue-store";

// Mocking Hymn for tests
const mockHymn = (id: number, title: string) => ({
  id,
  title,
  number: null,
  author: null,
  album: null,
  lyrics: null,
  chords: null,
  audioPath: null,
  playbackPath: null,
  category: null,
  notes: null,
  coverPath: null,
  lyricsSync: null,
  apiMusicId: 0,
  createdAt: "",
  updatedAt: "",
});

describe("Queue Store", () => {
  test("initial state", () => {
    const state = useQueueStore.getState();
    assert.strictEqual(state.items.length, 0);
    assert.strictEqual(state.currentIndex, -1);
  });

  test("addToQueue adds items", () => {
    useQueueStore.getState().clearQueue();
    const item1 = { id: "1", hymn: mockHymn(1, "Hymn 1"), type: "audio" as const };
    const item2 = { id: "2", hymn: mockHymn(2, "Hymn 2"), type: "projection" as const };
    
    useQueueStore.getState().addToQueue([item1, item2]);
    
    const state = useQueueStore.getState();
    assert.strictEqual(state.items.length, 2);
    assert.strictEqual(state.currentIndex, 0);
  });

  test("removeFromQueue updates items and currentIndex", () => {
    useQueueStore.getState().clearQueue();
    const item1 = { id: "1", hymn: mockHymn(1, "Hymn 1"), type: "audio" as const };
    const item2 = { id: "2", hymn: mockHymn(2, "Hymn 2"), type: "projection" as const };
    const item3 = { id: "3", hymn: mockHymn(3, "Hymn 3"), type: "audio" as const };
    
    useQueueStore.getState().addToQueue([item1, item2, item3]);
    useQueueStore.getState().setCurrentIndex(1); // Item 2
    
    // Remove item before current
    useQueueStore.getState().removeFromQueue(0);
    assert.strictEqual(useQueueStore.getState().currentIndex, 0); // Should point to Item 2 (now at index 0)
    
    // Remove current item
    useQueueStore.getState().removeFromQueue(0);
    assert.strictEqual(useQueueStore.getState().items.length, 1);
    assert.strictEqual(useQueueStore.getState().currentIndex, 0); // Should point to Item 3 (now at index 0)
    
    // Remove last item
    useQueueStore.getState().removeFromQueue(0);
    assert.strictEqual(useQueueStore.getState().items.length, 0);
    assert.strictEqual(useQueueStore.getState().currentIndex, -1);
  });

  test("next and prev navigation", () => {
    useQueueStore.getState().clearQueue();
    const item1 = { id: "1", hymn: mockHymn(1, "Hymn 1"), type: "audio" as const };
    const item2 = { id: "2", hymn: mockHymn(2, "Hymn 2"), type: "projection" as const };
    
    useQueueStore.getState().addToQueue([item1, item2]);
    
    assert.strictEqual(useQueueStore.getState().currentIndex, 0);
    useQueueStore.getState().next();
    assert.strictEqual(useQueueStore.getState().currentIndex, 1);
    useQueueStore.getState().next(); // Should not exceed bounds
    assert.strictEqual(useQueueStore.getState().currentIndex, 1);
    
    useQueueStore.getState().prev();
    assert.strictEqual(useQueueStore.getState().currentIndex, 0);
    useQueueStore.getState().prev(); // Should not go below 0
    assert.strictEqual(useQueueStore.getState().currentIndex, 0);
  });
});
