# Design: Unified Absolute-Path Media Serving

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Remove file-copy-on-select pattern; store absolute paths; serve all local media through the streaming server.

---

## Problem

When a user selects an image or video for a slide, the app currently:
1. Copies the file into `app_data_dir/media/images/` or `media/videos/`
2. Stores a relative path like `"media/images/abc123.jpg"` in the DB
3. Resolves that relative path at display time via `convertFileSrc` (Tauri asset protocol)

This causes unnecessary file duplication. The user already has the file on disk; copying it is redundant. The Rust backend has full OS access and can read any file the user selects — no copy step is needed.

---

## Decisions

| Question | Decision |
|----------|----------|
| Backward compatibility | Clean slate — no migration of existing relative paths |
| Streaming server | Single unified `/media/` endpoint handles both absolute and relative paths |
| Projector display | All media served via streaming server HTTP URLs (not asset protocol) |
| Archive export | Absolute-path media files are bundled into the `.slja` at export time |
| yt-dlp downloads | Unchanged — still stored as `media/videos/hash.mp4` relative paths |
| Album covers | Unchanged — still copied to `media/covers/`, managed by CDN sync |

---

## Architecture

### Data Layer

`SlideContent` fields `backgroundImage`, `videoPath`, and `videoUrl` store **absolute OS paths** for user-selected files:

```json
{ "backgroundImage": "/Users/user/Downloads/background.jpg" }
{ "videoPath": "C:\\Users\\user\\Videos\\clip.mp4" }
```

No DB schema change — paths are values inside the existing `slides.content` JSON blob.

**Unchanged paths:**
- `media/videos/hash.mp4` — yt-dlp downloads (relative, still resolved against `app_data_dir`)
- `media/covers/hash.jpg` — album covers (CDN-managed)

---

### Streaming Server (Rust)

**Route:** `GET /media/<percent-encoded-path>`

Path resolution logic in `streaming/mod.rs`:

```rust
let decoded = percent_decode_str(&raw_path).decode_utf8()?;

// NOTE: Remove the existing guard that rejects paths starting with '/' (line ~638-641).
// Absolute macOS/Linux paths like /Users/user/file.jpg start with '/' and are valid here.

let file_path = if Path::new(&*decoded).is_absolute() {
    // Absolute path — user selected this file; Rust reads directly from OS
    // On macOS/Linux: /Users/user/file.jpg  → is_absolute() = true
    // On Windows: C:\Users\user\file.mp4    → is_absolute() = true
    // Cross-platform assumption: the streaming server runs on the same OS
    // that produced the path, so is_absolute() is always evaluated correctly.
    PathBuf::from(&*decoded)
} else {
    // Relative path — yt-dlp downloads (media/videos/hash.mp4), album covers
    // Traversal guard still applies: reject "..", null bytes
    media_root.join(&*decoded)
};

// Validate file exists and is a regular file (not a directory or symlink)
let canonical = file_path.canonicalize()?;
// For relative paths only: re-validate canonical path stays inside app_data_dir
```

Security: existing path traversal checks (`..`, null bytes) are unchanged and still apply to the relative-path branch.

---

### Frontend — `useMediaSource` Hook

Converts any local path to a streaming server URL. Becomes **synchronous** (no more async `appDataDir()` resolution):

```ts
function useMediaSource(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:"))
    return path; // YouTube, data URIs — pass through unchanged
  return `http://127.0.0.1:${streamingPort}/media/${encodeURIComponent(path)}`;
}
```

`streamingPort` is obtained once at startup via `get_streaming_port() -> u16` IPC command, registered in `src-tauri/src/commands/streaming.rs` (or alongside existing streaming commands). The hook returns `null` and renders nothing until the port is resolved. This matches the existing async pattern where media was previously unavailable before `appDataDir()` resolved — no visible regression.

**Removed:** `appDataDir()` call, `convertFileSrc()` call, async resolution cache Map.

---

### Frontend — File Pickers

`background-picker.tsx`, video picker, and any other component that selects media files:

```ts
// Before
const absolutePath = await open({ filters: [...] });
const relativePath = await copyImageToMedia(absolutePath); // ← removed
saveSlide({ backgroundImage: relativePath });

// After
const absolutePath = await open({ filters: [...] });
saveSlide({ backgroundImage: absolutePath }); // store directly
```

**Removed mutations:** `useCopySlideImageToMedia`, `useCopyVideoToMedia` (for slide content).
**Removed Rust commands:** `copy_slide_image_to_media`, `copy_video_to_media` (for slide content).

---

### Frontend — `video-slide.tsx`

Removes the `resolveMediaPath` IPC call. Path arrives from slide content → `useMediaSource` → streaming URL → `<video src>`. No async resolution step.

---

### Frontend — `video-card.tsx` and `online-video-slide.tsx`

**`video-card.tsx`:** `handleProject` currently calls `appDataDir()` + joins with `video.localPath` to build an absolute path, then stores it in `videoUrl`. After this refactor, `video.localPath` (a relative managed path like `media/videos/hash.mp4`) is stored directly in `videoUrl` — no `appDataDir()` call, no absolute path construction. `useMediaSource` handles the rest.

**`online-video-slide.tsx`:** For `videoSource === "local"`, `slide.videoUrl` will be a relative path (`media/videos/hash.mp4`). Replace `convertFileSrc(slide.videoUrl)` with `useMediaSource(slide.videoUrl)` — which returns the streaming server URL. The `<video src>` receives the HTTP URL.

Data flow after refactor for local online videos:
```
video.localPath = "media/videos/abc.mp4"          (stored in DB by yt-dlp)
  ↓ video-card.tsx handleProject
videoUrl = "media/videos/abc.mp4"                  (no change, stored directly)
  ↓ online-video-slide.tsx
useMediaSource("media/videos/abc.mp4")
  → "http://127.0.0.1:{port}/media/media%2Fvideos%2Fabc.mp4"
  ↓
<video src="http://127.0.0.1:{port}/media/media%2Fvideos%2Fabc.mp4" />
  ↓ streaming server
media_root.join("media/videos/abc.mp4")            (relative branch)
  → serves file from app_data_dir/media/videos/abc.mp4
```

---

### Frontend — `SlideRenderer` fallback removal

`SlideRenderer` currently falls back to `slide.backgroundImage` raw when `useMediaSource` returns `null`:
```ts
// Current — REMOVE this fallback:
resolvedBackgroundPath ?? slide.backgroundImage ?? null
```

After this refactor, `slide.backgroundImage` is an absolute OS path. Browsers in the Tauri webview cannot load `file://`-style paths directly. The raw fallback must be removed — render nothing (or a placeholder) until the port is ready, exactly as the blank frame during `appDataDir()` resolution worked before.

---

### Streaming HTML Templates

`toStreamingMediaUrl()` in `music.html` and `return.html`:

```js
function toStreamingMediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("https://") ||
      path.startsWith("data:") || path.startsWith("blob:"))
    return path;
  // Encode entire path (including slashes) for safe embedding after /media/
  return "/media/" + encodeURIComponent(path);
}
```

This handles both absolute paths (`/Users/...`, `C:\...`) and legacy relative paths (`media/videos/...`) uniformly.

---

### Archive Export (.slja)

At export time, the Rust archiver scans each slide's `content` JSON for absolute media paths and bundles the files:

```rust
fn extract_media_paths(content: &SlideContent) -> Vec<&str> {
    [&content.background_image, &content.video_path, &content.video_url]
        .into_iter()
        .flatten()
        .map(String::as_str)
        .filter(|p| Path::new(p).is_absolute())
        .collect()
}

// For each absolute media path:
// - Read file from disk (full OS access)
// - Bundle into archive as "media/<original_filename>"
// - Rewrite path in exported slide content to relative "media/<filename>"
```

**Filename collision strategy:** If multiple slides reference files with the same base name (e.g., three different `background.jpg` files from different directories), the archiver appends a counter starting at 2: `background.jpg`, `background_2.jpg`, `background_3.jpg`, etc. The rewritten path in the exported slide content reflects the renamed filename. This is resolved at export time, not import time. The counter increments for every additional collision beyond the first.

On **import**: bundled media files are written to `app_data_dir/media/<filename>` and paths are restored as absolute paths using forward slashes on all platforms: `<app_data_dir>/media/<filename>`. The streaming server receives this forward-slash path; `Path::new(p).is_absolute()` correctly identifies it as absolute on all platforms since `app_data_dir` (from Tauri's `path()` API) always returns a platform-appropriate absolute path.

---

## Components Affected

| File | Change |
|------|--------|
| `src-tauri/src/streaming/mod.rs` | Path resolution: branch on absolute vs. relative; remove leading-slash guard (returns 404 for `/`-prefixed paths) |
| `src-tauri/src/commands/video_copy.rs` | Remove `copy_slide_image_to_media`, `copy_video_to_media` (slide content only) |
| `src-tauri/src/commands/utility.rs` | Remove `resolve_media_path` command (dead code) |
| `src-tauri/src/commands/streaming.rs` | **New** `get_streaming_port() -> u16` command; register in `collect_commands!` in `lib.rs` |
| `src-tauri/src/archive/mod.rs` | Bundle absolute-path media at export; restore on import |
| `src/hooks/use-media-source.ts` | Replace `convertFileSrc` with streaming server URL builder (synchronous) |
| `src/components/slides/slide-renderer.tsx` | Remove raw `slide.backgroundImage` fallback (unsafe with absolute paths in webview) |
| `src/components/slides/background-picker.tsx` | Remove copy mutation; store absolute path directly |
| `src/components/slides/fields/image-fields.tsx` | Remove `useCopySlideImageToMedia`; store absolute path directly |
| `src/components/slides/video-picker.tsx` | Remove `useCopyVideoToMedia`; store absolute path directly |
| `src/components/slides/video-slide.tsx` | Remove `resolveMediaPath` IPC call; use `useMediaSource` |
| `src/components/bible/projection-settings.tsx` | Remove `useCopyImageToMedia`; store absolute path directly |
| `src/components/online-videos/video-card.tsx` | Remove `appDataDir()` join in `handleProject`; store `video.localPath` directly in `videoUrl` |
| `src/components/online-videos/online-video-slide.tsx` | Replace `convertFileSrc(videoUrl)` with `useMediaSource(videoUrl)` for local videos |
| `src-tauri/src/streaming/templates/music.html` | Update `toStreamingMediaUrl` encoding |
| `src-tauri/src/streaming/templates/return.html` | Update `toStreamingMediaUrl` encoding |
| `src/lib/tauri/utilities.ts` | Remove `copySlideImageToMedia`, `copyVideoToMedia`, `resolveMediaPath` wrappers; add `getStreamingPort` |
| `src/lib/queries/utilities.ts` | Remove `useCopySlideImageToMedia`, `useCopyVideoToMedia`, `useResolveMediaPath` hooks |

**Out of scope (intentionally unchanged):**
- `src/components/settings/appearance-section.tsx` — projector logo is a managed app asset. Keeps `useCopyImageToMedia` / relative path pattern.
- `copy_image_to_media` Rust command — still used for album covers and logo. Not removed.

---

## CSP Configuration

The Tauri webview Content Security Policy must allow loading images and media from the local streaming server. Verify (or add) in `tauri.conf.json` or `capabilities/`:

```
img-src 'self' http://127.0.0.1:* data: blob:
media-src 'self' http://127.0.0.1:* blob:
```

If already present (the streaming panel previews already load from `127.0.0.1`), no change is needed. This must be confirmed during implementation.

---

## Testing Strategy (TDD — write failing tests first)

### Rust: `streaming/mod.rs` — `serve_media` path resolution

| Input (decoded path) | Expected result |
|---|---|
| `/tmp/file.jpg` (absolute, exists) | Reads file directly, returns 200 |
| `media/videos/abc.mp4` (relative, exists in `app_data_dir`) | Joins with `media_root`, returns 200 |
| `/tmp/file.jpg` (absolute, does not exist) | Returns 404 |
| `../etc/passwd` | Returns 404 (traversal rejected) |
| `media/../../etc/passwd` | Returns 404 (traversal rejected) |
| path with null byte `\0` | Returns 404 |
| `/tmp/file.jpg` with `%2F` encoding | Percent-decoded correctly, resolves to `/tmp/file.jpg` |
| `C:\Users\user\file.mp4` on Windows (absolute) | Recognized as absolute, reads directly |
| empty string | Returns 404 |

### Rust: `archive/mod.rs` — `extract_media_paths`

| Input | Expected |
|---|---|
| `backgroundImage: "/abs/path/bg.jpg"` | Returns `["/abs/path/bg.jpg"]` |
| `videoPath: "media/videos/hash.mp4"` (relative) | Returns `[]` (relative paths not bundled) |
| `backgroundImage: null` | Returns `[]` |
| two slides referencing same-name `background.jpg` from different dirs | Second archived as `background_2.jpg`; slide content rewritten |
| three slides each with `background.jpg` from different dirs | `background.jpg`, `background_2.jpg`, `background_3.jpg`; each slide content rewritten |

### Frontend: `useMediaSource`

| Input | Expected output |
|---|---|
| `null` | `null` |
| `""` | `null` |
| `"http://youtube.com/..."` | passed through unchanged |
| `"data:image/png;base64,..."` | passed through unchanged |
| `"blob:..."` | passed through unchanged |
| `"/Users/user/bg.jpg"` | `http://127.0.0.1:{port}/media/%2FUsers%2Fuser%2Fbg.jpg` |
| `"media/videos/hash.mp4"` | `http://127.0.0.1:{port}/media/media%2Fvideos%2Fhash.mp4` |
| `"/path/with spaces/bg.jpg"` | `http://127.0.0.1:{port}/media/%2Fpath%2Fwith%20spaces%2Fbg.jpg` |
| called before port is known | `null` |

### Frontend: `toStreamingMediaUrl` (HTML templates)

Same cases as `useMediaSource` — both must produce identical URL encoding.

---

## What Does NOT Change

- yt-dlp download paths (`media/videos/...`) — relative, still resolved against `app_data_dir`
- Album cover copy (`copy_image_to_media`) — CDN-managed, separate use case
- Projection controls in "Playing now" route — IPC-based, unrelated to media paths
- `slide-changed` event flow — still emitted from Rust, listened by projector/return/playing-now
- All audio playback paths — not media files in this sense
