import { test } from "node:test";
import { strict as assert } from "node:assert";

import { buildAssetPath } from "../src/lib/asset-url";

test("unix path + relative path", () => {
  assert.equal(
    buildAssetPath("/Users/user/Library/Application Support/com.louvorja/", "media/covers/foo.jpg"),
    "/Users/user/Library/Application Support/com.louvorja/media/covers/foo.jpg",
  );
});

test("unix path without trailing slash", () => {
  assert.equal(
    buildAssetPath("/Users/user/Library/Application Support/com.louvorja", "media/covers/foo.jpg"),
    "/Users/user/Library/Application Support/com.louvorja/media/covers/foo.jpg",
  );
});

test("windows path - normalizes backslashes", () => {
  assert.equal(
    buildAssetPath("C:\\Users\\user\\AppData\\Roaming\\com.louvorja\\", "media/covers/foo.jpg"),
    "C:/Users/user/AppData/Roaming/com.louvorja/media/covers/foo.jpg",
  );
});

test("windows path without trailing backslash", () => {
  assert.equal(
    buildAssetPath("C:\\Users\\user\\AppData\\Roaming\\com.louvorja", "media/covers/foo.jpg"),
    "C:/Users/user/AppData/Roaming/com.louvorja/media/covers/foo.jpg",
  );
});

test("relative path with backslashes is normalized", () => {
  assert.equal(
    buildAssetPath("C:\\Users\\user\\AppData\\", "media\\covers\\foo.jpg"),
    "C:/Users/user/AppData/media/covers/foo.jpg",
  );
});

test("linux app data dir path", () => {
  assert.equal(
    buildAssetPath("/home/user/.local/share/com.louvorja/", "media/videos/song.mp4"),
    "/home/user/.local/share/com.louvorja/media/videos/song.mp4",
  );
});
