import { test } from "node:test";
import { strict as assert } from "node:assert";

import { normalizeMediaPath } from "../src/lib/media-path";

test("prefixes media/ for relative paths", () => {
  assert.equal(normalizeMediaPath("song.mp3"), "media/song.mp3");
});

test("preserves existing media/ paths", () => {
  assert.equal(normalizeMediaPath("media/audio/song.mp3"), "media/audio/song.mp3");
});

test("preserves absolute local paths", () => {
  assert.equal(normalizeMediaPath("/Users/test/audio/song.mp3"), "/Users/test/audio/song.mp3");
  assert.equal(normalizeMediaPath("C:\\Music\\song.mp3"), "C:/Music/song.mp3");
});

test("preserves explicit URL/data/blob paths", () => {
  assert.equal(normalizeMediaPath("https://cdn.example.com/song.mp3"), "https://cdn.example.com/song.mp3");
  assert.equal(normalizeMediaPath("blob:https://example.com/token"), "blob:https://example.com/token");
  assert.equal(normalizeMediaPath("data:audio/mp3;base64,AAAA"), "data:audio/mp3;base64,AAAA");
});

test("returns null for empty values", () => {
  assert.equal(normalizeMediaPath(""), null);
  assert.equal(normalizeMediaPath("   "), null);
});
