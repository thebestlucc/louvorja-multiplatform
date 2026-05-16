import { test, describe } from "node:test";
import * as assert from "node:assert";

// Stub Tauri IPC before importing bindings.
// Map command names → mock responses for getHymn and getVerses.
(globalThis as any).window = {
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args?: any) => {
      // The binding wraps invoke result in { status: "ok", data: <result> },
      // so return the unwrapped value here.
      if (cmd === "get_hymn") {
        const id = args?.id ?? 0;
        return Promise.resolve({ id, title: `Hymn ${id}` });
      }
      if (cmd === "get_verses") {
        const { versionId, book, chapter } = args ?? {};
        return Promise.resolve([
          { id: 1, versionId, book, chapter, verse: 1, text: "v1" },
          { id: 2, versionId, book, chapter, verse: 2, text: "v2" },
        ]);
      }
      return Promise.resolve(null);
    },
  },
};

// Import after stubbing.
import { buildQueueItemsFromRemote } from "../../src/hooks/build-queue-items-from-remote";

describe("buildQueueItemsFromRemote", () => {
  test("builds a mixed-kind queue", async () => {
    const result = await buildQueueItemsFromRemote({
      items: [
        { kind: "hymn", hymnId: 7 },
        { kind: "bible", versionId: 1, book: "John", bookName: "John", chapter: 3, verse: 16 },
        { kind: "video", videoSource: "youtube", videoId: "abc", videoTitle: "T" },
        { kind: "presentation", presentationId: 42 },
      ],
    });
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].kind, "hymn");
    assert.strictEqual(result[0].hymn?.id, 7);
    assert.strictEqual(result[1].kind, "bible");
    assert.strictEqual(result[1].bibleContext?.verses.length, 2);
    assert.strictEqual(result[1].bibleContext?.initialVerse, 16);
    assert.strictEqual(result[2].kind, "video");
    assert.strictEqual(result[2].videoMedia?.videoId, "abc");
    assert.strictEqual(result[3].kind, "presentation");
    assert.strictEqual(result[3].presentationId, 42);
  });
});
