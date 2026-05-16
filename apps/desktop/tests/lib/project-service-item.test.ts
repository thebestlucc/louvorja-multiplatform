import { test, describe, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";

// Smart invoke stub — mutated per test via invokeResponses map
const invokeResponses: Record<string, unknown> = {
  set_current_slide: null,
  set_slide_context: null,
  audio_play: null,
};

(globalThis as unknown as Record<string, unknown>).window = {
  __TAURI_INTERNALS__: {
    invoke: (command: string) => Promise.resolve(invokeResponses[command] ?? null),
  },
};

import { projectServiceItem } from "../../src/lib/project-service-item";
import { useMediaPlayerStore } from "../../src/stores/media-player-store";
import type { LiturgyItem as ServiceItem } from "../../src/lib/bindings";
import type { MediaItem } from "../../src/types/media";

function makeItem(overrides: Partial<ServiceItem> = {}): ServiceItem {
  return {
    id: 1,
    serviceId: 1,
    itemType: "annotation",
    itemId: null,
    title: "Test Item",
    itemOrder: 0,
    notes: null,
    parentId: null,
    ...overrides,
  };
}

// Minimal Hymn shape matching bindings.Hymn
function makeHymn(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    title: "Holy Holy Holy",
    number: null,
    author: null,
    album: "Hymnal",
    lyrics: "Holy holy holy\n\nGod almighty",
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
    ...overrides,
  };
}

// Minimal Slide with text SlideContent JSON
function makeSlide(id: number, presentationId: number) {
  const content = JSON.stringify({
    slideType: "text",
    content: `Slide ${id}`,
    background: { kind: "solid", color: "#000000", imagePath: null, gradientStart: null, gradientEnd: null, gradientAngle: null, opacity: null },
    text_color: null,
    text_size: null,
  });
  return { id, presentationId, slideIndex: id - 1, slideType: "text", content, notes: null, transition: null };
}

// Minimal MediaLibraryItem
function makeMediaItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    categoryId: 1,
    name: "Test Media",
    filePath: "/media/test.jpg",
    fileType: "jpg",
    thumbnailPath: null,
    scheduledDate: null,
    sortOrder: 0,
    createdAt: "",
    ...overrides,
  };
}

// Minimal OnlineVideo
function makeOnlineVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    idPlaylist: 1,
    videoId: "abc123",
    sequence: 0,
    title: "Test Video",
    description: null,
    images: null,
    status: "pending",
    error: null,
    localPath: null,
    durationSeconds: null,
    ...overrides,
  };
}

describe("projectServiceItem — mediaStore.load dispatch", () => {
  let capturedLoad: MediaItem | null = null;
  let origLoad: (item: MediaItem) => void;

  beforeEach(() => {
    capturedLoad = null;
    // Clear per-test IPC overrides (keep base stubs)
    for (const key of ["get_hymn", "get_sync_points", "get_slides", "get_scheduled_media_item", "find_online_video_by_yt_id"]) {
      delete invokeResponses[key];
    }
    // Spy on mediaStore.load
    origLoad = useMediaPlayerStore.getState().load;
    useMediaPlayerStore.setState({
      load: (item) => {
        capturedLoad = item;
        origLoad(item);
      },
    });
  });

  afterEach(() => {
    useMediaPlayerStore.setState({ load: origLoad });
  });

  // ── annotation ───────────────────────────────────────────────────────────────

  test("annotation: loads annotation media item", async () => {
    const item = makeItem({ itemType: "annotation", notes: "Sermon text" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
    assert.strictEqual((capturedLoad as any).text, "Sermon text");
  });

  // ── bible ────────────────────────────────────────────────────────────────────

  test("bible: loads bible media item with reference and text", async () => {
    const item = makeItem({ itemType: "bible", title: "John 3:16", notes: "For God so loved..." });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "bible");
    assert.strictEqual((capturedLoad as any).reference, "John 3:16");
    assert.strictEqual((capturedLoad as any).text, "For God so loved...");
  });

  // ── hymn without itemId ───────────────────────────────────────────────────────

  test("hymn without itemId: loads annotation (lyric text fallback)", async () => {
    const item = makeItem({ itemType: "hymn", itemId: null, notes: "Stanza text" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
  });

  // ── hymn with itemId ─────────────────────────────────────────────────────────

  test("hymn with itemId: fetches hymn and loads hymn media item", async () => {
    invokeResponses["get_hymn"] = makeHymn();
    invokeResponses["get_sync_points"] = [];
    const item = makeItem({ itemType: "hymn", itemId: 42 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "hymn");
    assert.strictEqual((capturedLoad as any).hymn.id, 42);
    assert.strictEqual((capturedLoad as any).mode, "sung");
  });

  test("hymn with itemId and no lyrics: still loads hymn media item", async () => {
    invokeResponses["get_hymn"] = makeHymn({ lyrics: null });
    invokeResponses["get_sync_points"] = [];
    const item = makeItem({ itemType: "hymn", itemId: 42 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "hymn");
  });

  // ── presentation ─────────────────────────────────────────────────────────────

  test("presentation with itemId: fetches slides and loads presentation", async () => {
    invokeResponses["get_slides"] = [makeSlide(1, 5)];
    const item = makeItem({ itemType: "presentation", itemId: 5 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "presentation");
    assert.strictEqual((capturedLoad as any).presentationId, 5);
    assert.strictEqual((capturedLoad as any).slides.length, 1);
  });

  test("presentation with empty slides: does not load", async () => {
    invokeResponses["get_slides"] = [];
    const item = makeItem({ itemType: "presentation", itemId: 5 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad, null);
  });

  test("presentation without itemId: does not load", async () => {
    const item = makeItem({ itemType: "presentation", itemId: null });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad, null);
  });

  // ── file — image ─────────────────────────────────────────────────────────────

  test("file (jpg): loads image media item", async () => {
    const item = makeItem({ itemType: "file", notes: "/path/photo.jpg", title: "Photo" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "image");
    assert.strictEqual((capturedLoad as any).imagePath, "/path/photo.jpg");
  });

  test("file (png): loads image media item", async () => {
    const item = makeItem({ itemType: "file", notes: "/path/banner.png", title: "Banner" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "image");
  });

  // ── file — video ─────────────────────────────────────────────────────────────

  test("file (mp4): loads offline_video media item", async () => {
    const item = makeItem({ itemType: "file", notes: "/clips/announcement.mp4", title: "Clip" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "offline_video");
    assert.strictEqual((capturedLoad as any).videoPath, "/clips/announcement.mp4");
    assert.strictEqual((capturedLoad as any).isManaged, false);
  });

  test("file (webm): loads offline_video media item", async () => {
    const item = makeItem({ itemType: "file", notes: "/clips/recording.webm", title: "Recording" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "offline_video");
  });

  // ── file — audio ─────────────────────────────────────────────────────────────

  test("file (mp3): loads annotation (title as text)", async () => {
    const item = makeItem({ itemType: "file", notes: "/audio/track.mp3", title: "Background Music" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
    assert.strictEqual((capturedLoad as any).title, "Background Music");
  });

  test("file (wav): loads annotation media item", async () => {
    const item = makeItem({ itemType: "file", notes: "/audio/sfx.wav", title: "SFX" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
  });

  // ── file — unknown ────────────────────────────────────────────────────────────

  test("file (pdf/unknown ext): loads annotation", async () => {
    const item = makeItem({ itemType: "file", notes: "/docs/bulletin.pdf", title: "Bulletin" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
  });

  // ── scheduled_category ───────────────────────────────────────────────────────

  test("scheduled_category (image): loads image media item", async () => {
    invokeResponses["get_scheduled_media_item"] = makeMediaItem({ filePath: "/banners/easter.png", fileType: "png" });
    const item = makeItem({ itemType: "scheduled_category", itemId: 1 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "image");
    assert.strictEqual((capturedLoad as any).imagePath, "/banners/easter.png");
  });

  test("scheduled_category (video): loads offline_video media item", async () => {
    invokeResponses["get_scheduled_media_item"] = makeMediaItem({ filePath: "/vids/announce.mp4", fileType: "mp4" });
    const item = makeItem({ itemType: "scheduled_category", itemId: 1 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "offline_video");
    assert.strictEqual((capturedLoad as any).videoPath, "/vids/announce.mp4");
  });

  test("scheduled_category (audio): loads offline_video media item", async () => {
    invokeResponses["get_scheduled_media_item"] = makeMediaItem({ filePath: "/audio/song.mp3", fileType: "mp3" });
    const item = makeItem({ itemType: "scheduled_category", itemId: 1 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "offline_video");
  });

  test("scheduled_category (unknown type): loads annotation", async () => {
    invokeResponses["get_scheduled_media_item"] = makeMediaItem({ filePath: "/docs/flyer.pdf", fileType: "pdf", name: "Flyer" });
    const item = makeItem({ itemType: "scheduled_category", itemId: 1 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
  });

  test("scheduled_category (not found): does not load media", async () => {
    invokeResponses["get_scheduled_media_item"] = null;
    const item = makeItem({ itemType: "scheduled_category", itemId: 1 });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad, null);
  });

  // ── online_video — local download ─────────────────────────────────────────────

  test("online_video (local path): loads offline_video with isManaged=true", async () => {
    invokeResponses["find_online_video_by_yt_id"] = makeOnlineVideo({ localPath: "/managed/videos/abc123.mp4", status: "downloaded" });
    const item = makeItem({
      itemType: "online_video",
      notes: JSON.stringify({ videoId: "abc123", videoUrl: "https://youtube.com/watch?v=abc123", videoSource: "youtube", channelName: "Test", duration: 180, downloadForOffline: true }),
      title: "Downloaded Video",
    });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "offline_video");
    assert.strictEqual((capturedLoad as any).videoPath, "/managed/videos/abc123.mp4");
    assert.strictEqual((capturedLoad as any).isManaged, true);
  });

  // ── online_video — YouTube ────────────────────────────────────────────────────

  test("online_video (youtube): loads online_video with videoId", async () => {
    invokeResponses["find_online_video_by_yt_id"] = makeOnlineVideo({ videoId: "xyz789", localPath: null });
    const item = makeItem({
      itemType: "online_video",
      notes: JSON.stringify({ videoId: "xyz789", videoUrl: "https://youtube.com/watch?v=xyz789", videoSource: "youtube", channelName: "Test", duration: 120, downloadForOffline: false }),
      title: "YouTube Clip",
    });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "online_video");
    assert.strictEqual((capturedLoad as any).videoId, "xyz789");
    assert.strictEqual((capturedLoad as any).videoSource, "youtube");
  });

  test("online_video (no notes): loads online_video with empty videoId", async () => {
    invokeResponses["find_online_video_by_yt_id"] = null;
    const item = makeItem({ itemType: "online_video", notes: null, title: "Video" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "online_video");
    assert.strictEqual((capturedLoad as any).videoId, "");
  });

  // ── default / unknown itemType ────────────────────────────────────────────────

  test("unknown itemType: loads annotation as fallback", async () => {
    const item = makeItem({ itemType: "category" as ServiceItem["itemType"], notes: "Some content" });
    await projectServiceItem(item, [item]);
    assert.strictEqual(capturedLoad?.type, "annotation");
  });

  // ── multi-item context ────────────────────────────────────────────────────────

  test("item in middle of list: correct index without crashing", async () => {
    const item1 = makeItem({ id: 1, itemType: "annotation", notes: "First" });
    const item2 = makeItem({ id: 2, itemType: "annotation", notes: "Second" });
    const item3 = makeItem({ id: 3, itemType: "annotation", notes: "Third" });
    await projectServiceItem(item2, [item1, item2, item3]);
    assert.strictEqual(capturedLoad?.type, "annotation");
    assert.strictEqual((capturedLoad as any).text, "Second");
  });
});
