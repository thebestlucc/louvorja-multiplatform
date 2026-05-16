import { test } from "node:test";
import { strict as assert } from "node:assert";

import { buildMediaUrl } from "../src/lib/media-url";

test("returns null for null input", () => {
  assert.equal(buildMediaUrl(null, 7000), null);
});

test("returns null for undefined input", () => {
  assert.equal(buildMediaUrl(undefined, 7000), null);
});

test("returns null for empty string", () => {
  assert.equal(buildMediaUrl("", 7000), null);
});

test("returns null for whitespace-only string", () => {
  assert.equal(buildMediaUrl("   ", 7000), null);
});

test("passes through http URLs unchanged", () => {
  assert.equal(
    buildMediaUrl("http://youtube.com/watch?v=abc", 7000),
    "http://youtube.com/watch?v=abc",
  );
});

test("passes through https URLs unchanged", () => {
  assert.equal(
    buildMediaUrl("https://cdn.example.com/image.jpg", 7000),
    "https://cdn.example.com/image.jpg",
  );
});

test("passes through data URIs unchanged", () => {
  assert.equal(
    buildMediaUrl("data:image/png;base64,abc", 7000),
    "data:image/png;base64,abc",
  );
});

test("passes through blob URIs unchanged", () => {
  assert.equal(
    buildMediaUrl("blob:http://localhost/abc", 7000),
    "blob:http://localhost/abc",
  );
});

test("encodes absolute path to streaming URL", () => {
  assert.equal(
    buildMediaUrl("/Users/user/bg.jpg", 7000),
    "http://127.0.0.1:7000/media/%2FUsers%2Fuser%2Fbg.jpg",
  );
});

test("encodes relative media path to streaming URL", () => {
  assert.equal(
    buildMediaUrl("media/videos/hash.mp4", 7000),
    "http://127.0.0.1:7000/media/media%2Fvideos%2Fhash.mp4",
  );
});

test("encodes paths with spaces correctly", () => {
  assert.equal(
    buildMediaUrl("/path/with spaces/bg.jpg", 7000),
    "http://127.0.0.1:7000/media/%2Fpath%2Fwith%20spaces%2Fbg.jpg",
  );
});

test("returns null when port is null", () => {
  assert.equal(buildMediaUrl("/Users/user/bg.jpg", null), null);
});

test("returns null when port is undefined", () => {
  assert.equal(buildMediaUrl("media/images/cover.jpg", undefined), null);
});

test("uses the provided port number in the URL", () => {
  assert.equal(
    buildMediaUrl("/image.jpg", 8080),
    "http://127.0.0.1:8080/media/%2Fimage.jpg",
  );
});
