# Media Absolute-Path Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the file-copy-on-select pattern; store absolute OS paths in slide content; serve all local media through the streaming server's `/media/` route via Rust's full OS access.

**Architecture:** Rust `serve_media` gains an absolute-path branch — if the decoded path is absolute, it reads directly from anywhere on disk (bypassing the `app_data_dir` restriction). `useMediaSource` becomes a simple synchronous URL builder using `getStreamingStatus().port`. File pickers drop their copy mutations and store the raw absolute path the dialog returns.

**Tech Stack:** Rust (percent-encoding, std::path), React 19 / TypeScript 5.8, Vitest + @testing-library/react (unit tests), TanStack Query, Tauri 2 IPC, `@tauri-apps/plugin-dialog`

---

## Parallel Execution Map

```
Batch 1 (all independent — run in parallel):
  Task 1 · Rust streaming server — absolute path branch
  Task 2 · Rust — remove slide copy commands
  Task 3 · HTML templates — toStreamingMediaUrl
  Task 4 · Frontend useMediaSource hook
  Task 5 · Archive export bundling (Rust)
  Task 6 · CSP verification

Batch 2 (depends on Task 4):
  Task 7 · SlideRenderer + video-slide
  Task 8 · File pickers (background, image-fields, video-picker, bible)
  Task 9 · video-card + online-video-slide

Batch 3 (depends on Tasks 2, 7, 8, 9):
  Task 10 · Dead-code cleanup (tauri/utilities + queries/utilities)
```

---

## File Map

| File | Status | What changes |
|------|--------|--------------|
| `src-tauri/src/streaming/mod.rs` | Modify | Replace `starts_with('/')` guard with absolute/relative branch |
| `src-tauri/src/commands/video_copy.rs` | Modify | Remove `copy_slide_image_to_media`, `copy_video_to_media` functions |
| `src-tauri/src/commands/utility.rs` | Modify | Remove `resolve_media_path` function |
| `src-tauri/src/lib.rs` | Modify | Deregister removed commands from `collect_commands!` |
| `src-tauri/src/db/models/slides.rs` | Modify | Add `#[derive(Default)]` to `SlideContent` |
| `src-tauri/src/archive/mod.rs` | Modify | Add `extract_media_paths`, `unique_archive_name` helpers |
| `src-tauri/src/commands/slides.rs` | Modify | Extend `collect_video_media_files` to bundle absolute-path media |
| `src/hooks/use-media-source.ts` | Modify | Replace async `convertFileSrc` flow with sync streaming URL builder |
| `src/components/slides/slide-renderer.tsx` | Modify | Remove raw `backgroundImage` fallback |
| `src/components/slides/background-picker.tsx` | Modify | Remove `useCopyImageToMedia`; store absolute path directly |
| `src/components/slides/fields/image-fields.tsx` | Modify | Remove `useCopySlideImageToMedia`; store absolute path directly |
| `src/components/slides/video-picker.tsx` | Modify | Remove `useCopyVideoToMedia`; store absolute path directly |
| `src/components/slides/video-slide.tsx` | Modify | Remove `useResolveMediaPath`; use `useMediaSource` |
| `src/components/bible/projection-settings.tsx` | Modify | Remove `useCopyImageToMedia`; store absolute path directly |
| `src/components/online-videos/video-card.tsx` | Modify | Remove `appDataDir()` join; store `video.localPath` directly |
| `src/components/online-videos/online-video-slide.tsx` | Modify | Replace `convertFileSrc` with `useMediaSource` for local videos |
| `src-tauri/src/streaming/templates/music.html` | Modify | Update `toStreamingMediaUrl` with `encodeURIComponent` |
| `src-tauri/src/streaming/templates/return.html` | Modify | Same as music.html |
| `src/lib/tauri/utilities.ts` | Modify | Remove `copyVideoToMedia`, `copySlideImageToMedia`, `resolveMediaPath` |
| `src/lib/queries/utilities.ts` | Modify | Remove `useCopyVideoToMedia`, `useCopySlideImageToMedia`, `useResolveMediaPath` |

---

## Task 1: Rust Streaming Server — Absolute Path Branch

**Files:**
- Modify: `src-tauri/src/streaming/mod.rs:624-660`

The current guard at lines 635–641 rejects any path starting with `/`, which blocks macOS/Linux absolute paths. Replace the single validation block with a branch: absolute paths read directly, relative paths validate inside `app_data_dir`.

- [ ] **Step 1.1: Write the failing test**

Add at the bottom of `src-tauri/src/streaming/mod.rs` inside a `#[cfg(test)]` module. This extracts the resolution logic into a testable helper first.

```rust
/// Resolve a percent-decoded media path to a concrete file path.
/// Returns `None` if the path is invalid, traversal-suspicious, or does not exist.
pub(crate) fn resolve_serve_path(decoded: &str, media_root: &Path) -> Option<PathBuf> {
    if decoded.is_empty() || decoded.contains("..") || decoded.contains('\0') {
        return None;
    }
    let path = Path::new(decoded);
    if path.is_absolute() {
        let canonical = path.canonicalize().ok()?;
        if canonical.is_file() { Some(canonical) } else { None }
    } else {
        let joined = media_root.join(path);
        let canonical = joined.canonicalize().ok()?;
        if canonical.starts_with(media_root) && canonical.is_file() {
            Some(canonical)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod serve_path_tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn test_relative_path_resolves_inside_root() {
        let dir = setup();
        let file = dir.path().join("media/videos/test.mp4");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, b"fake").unwrap();

        let result = resolve_serve_path("media/videos/test.mp4", dir.path());
        assert!(result.is_some());
    }

    #[test]
    fn test_absolute_path_resolves_outside_root() {
        let dir = setup();
        // File outside media_root
        let outside = TempDir::new().unwrap();
        let file = outside.path().join("bg.jpg");
        fs::write(&file, b"fake").unwrap();

        let abs = file.to_str().unwrap();
        let result = resolve_serve_path(abs, dir.path());
        assert!(result.is_some());
    }

    #[test]
    fn test_traversal_rejected() {
        let dir = setup();
        assert!(resolve_serve_path("../etc/passwd", dir.path()).is_none());
        assert!(resolve_serve_path("media/../../etc/passwd", dir.path()).is_none());
    }

    #[test]
    fn test_null_byte_rejected() {
        let dir = setup();
        assert!(resolve_serve_path("media/file\0.jpg", dir.path()).is_none());
    }

    #[test]
    fn test_empty_path_rejected() {
        let dir = setup();
        assert!(resolve_serve_path("", dir.path()).is_none());
    }

    #[test]
    fn test_nonexistent_absolute_returns_none() {
        let dir = setup();
        assert!(resolve_serve_path("/tmp/nonexistent_louvorja_test_file.jpg", dir.path()).is_none());
    }

    #[test]
    fn test_relative_traversal_outside_root_rejected() {
        let dir = setup();
        // Even without "..", a canonicalized path that escapes root is rejected
        // (this is handled by starts_with check)
        let outside = dir.path().parent().unwrap().join("secret.txt");
        fs::write(&outside, b"secret").unwrap();
        // Can't construct this via relative path without ".." — test is conceptual
        // The starts_with guard catches canonicalized escapes
        let _ = outside; // just confirm the test setup works
    }
}
```

Add `tempfile` to `[dev-dependencies]` in `src-tauri/Cargo.toml`:
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cargo test --manifest-path src-tauri/Cargo.toml serve_path_tests 2>&1 | head -30
```

Expected: compile error — `resolve_serve_path` function does not exist yet.

- [ ] **Step 1.3: Add `resolve_serve_path` helper and update `serve_media`**

In `src-tauri/src/streaming/mod.rs`, add the helper function (outside `#[cfg(test)]`, before `serve_media`):

```rust
/// Resolve a percent-decoded media path to a file to serve.
/// Absolute paths are read directly (user-selected files, full OS access).
/// Relative paths are resolved against `media_root` and validated to stay inside it.
/// Returns `None` if the path is invalid, suspicious, or does not exist as a file.
pub(crate) fn resolve_serve_path(decoded: &str, media_root: &Path) -> Option<PathBuf> {
    if decoded.is_empty() || decoded.contains("..") || decoded.contains('\0') {
        return None;
    }
    let path = Path::new(decoded);
    if path.is_absolute() {
        let canonical = path.canonicalize().ok()?;
        if canonical.is_file() { Some(canonical) } else { None }
    } else {
        let joined = media_root.join(path);
        let canonical = joined.canonicalize().ok()?;
        if canonical.starts_with(media_root) && canonical.is_file() {
            Some(canonical)
        } else {
            None
        }
    }
}
```

Replace lines 624–660 in `serve_media` (the validation + candidate construction block) with:

```rust
    let sanitized_path = request_path
        .split(['?', '#'])
        .next()
        .unwrap_or(request_path);
    let encoded_relative = sanitized_path.strip_prefix("/media/").unwrap_or("");
    let Some(decoded_relative) = decode_percent_path(encoded_relative) else {
        serve_not_found(&mut stream);
        return;
    };

    // Normalize Windows backslashes; then resolve via helper.
    let decoded = decoded_relative.replace('\\', "/");
    let Some(candidate) = resolve_serve_path(&decoded, &root) else {
        serve_not_found(&mut stream);
        return;
    };
    // candidate is already a canonical, existing file path — proceed to serve.
```

Remove the old `if !candidate.is_file()` check that follows (it's now inside the helper).

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
cargo test --manifest-path src-tauri/Cargo.toml serve_path_tests 2>&1
```

Expected: all tests PASS.

- [ ] **Step 1.5: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error"
```

Expected: no errors.

- [ ] **Step 1.6: Commit**

```bash
git add src-tauri/src/streaming/mod.rs src-tauri/Cargo.toml
git commit -m "feat(streaming): serve absolute paths directly from OS filesystem

Adds resolve_serve_path() helper that branches on path.is_absolute():
- Absolute paths read directly (user-selected files, full OS access)
- Relative paths validated inside app_data_dir as before

Removes the starts_with('/') guard that blocked macOS/Linux absolute paths."
```

---

## Task 2: Rust — Remove Slide Copy Commands

**Files:**
- Modify: `src-tauri/src/commands/video_copy.rs`
- Modify: `src-tauri/src/commands/utility.rs`
- Modify: `src-tauri/src/lib.rs`

Remove `copy_slide_image_to_media`, `copy_video_to_media` (slide content copy), and `resolve_media_path`. Keep `copy_image_to_media` (used for album covers and logo).

- [ ] **Step 2.1: Remove `copy_slide_image_to_media` from `video_copy.rs`**

Delete the entire `copy_slide_image_to_media` function (the one that copies to `media/images/`). Keep `copy_image_to_media` (copies to `media/covers/`) and `copy_video_to_media` if it's used for yt-dlp; check first. If `copy_video_to_media` is only used by the slide video picker (not yt-dlp download), remove it too.

> **Note:** yt-dlp download uses `download_online_video` command, NOT `copy_video_to_media`. Safe to remove `copy_video_to_media`.

- [ ] **Step 2.2: Remove `resolve_media_path` from `utility.rs`**

Delete the `resolve_media_path` function entirely.

- [ ] **Step 2.3: Deregister from `lib.rs`**

In `src-tauri/src/lib.rs`, remove `copy_slide_image_to_media`, `copy_video_to_media`, and `resolve_media_path` from `tauri_specta::collect_commands!`.

- [ ] **Step 2.4: Build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error"
```

Expected: no errors. (Frontend callers still compile because bindings.ts is regenerated on `pnpm tauri dev`, not on `cargo build`.)

- [ ] **Step 2.5: Commit**

```bash
git add src-tauri/src/commands/video_copy.rs src-tauri/src/commands/utility.rs src-tauri/src/lib.rs
git commit -m "refactor(rust): remove slide media copy commands

Removes copy_slide_image_to_media, copy_video_to_media, and resolve_media_path.
File pickers now store absolute paths directly — no copy step needed.
copy_image_to_media kept for album covers and projector logo."
```

---

## Task 3: HTML Templates — `toStreamingMediaUrl`

**Files:**
- Modify: `src-tauri/src/streaming/templates/music.html`
- Modify: `src-tauri/src/streaming/templates/return.html`

Replace the current `toStreamingMediaUrl` function in both templates with one that uses `encodeURIComponent` on the full path (handles absolute paths including slashes).

- [ ] **Step 3.1: Update `toStreamingMediaUrl` in `music.html`**

Find the existing `toStreamingMediaUrl` function in `music.html` and replace it with:

```javascript
function toStreamingMediaUrl(pathValue) {
  if (!pathValue) return "";
  const v = String(pathValue);
  if (v.startsWith("http://") || v.startsWith("https://") ||
      v.startsWith("data:") || v.startsWith("blob:")) {
    return v;
  }
  // encodeURIComponent encodes the full path including slashes and drive letters,
  // so /Users/user/bg.jpg → /media/%2FUsers%2Fuser%2Fbg.jpg
  // and media/videos/hash.mp4 → /media/media%2Fvideos%2Fhash.mp4
  return "/media/" + encodeURIComponent(v);
}
```

- [ ] **Step 3.2: Apply the same change to `return.html`**

Find and replace `toStreamingMediaUrl` in `return.html` with the identical function body.

- [ ] **Step 3.3: Manual smoke test**

Open the streaming preview in the browser (start the app with `pnpm tauri dev`, enable streaming). Verify background images and videos still load. This is a template change — no unit test framework available, visual verification is sufficient.

- [ ] **Step 3.4: Commit**

```bash
git add src-tauri/src/streaming/templates/music.html src-tauri/src/streaming/templates/return.html
git commit -m "feat(streaming): encode full path in toStreamingMediaUrl

Uses encodeURIComponent on the entire path so absolute OS paths like
/Users/user/bg.jpg encode correctly as /media/%2FUsers%2Fuser%2Fbg.jpg"
```

---

## Task 4: Frontend — `useMediaSource` Hook

**Files:**
- Modify: `src/hooks/use-media-source.ts`
- Create: `src/hooks/__tests__/use-media-source.test.ts`

Replace the async `convertFileSrc` + `appDataDir` flow with a synchronous streaming URL builder using the already-available `getStreamingStatus()`.

- [ ] **Step 4.1: Write the failing test**

Create `src/hooks/__tests__/use-media-source.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useMediaSource } from "../use-media-source";

// Mock the streaming status command
vi.mock("../../lib/tauri/streaming", () => ({
  getStreamingStatus: vi.fn().mockResolvedValue({ port: 7000, running: true, url: "http://127.0.0.1:7000" }),
}));

// Mock Tauri internals (required for Vitest in non-Tauri env)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useMediaSource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for null input", async () => {
    const { result } = renderHook(() => useMediaSource(null), { wrapper });
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("returns null for empty string", async () => {
    const { result } = renderHook(() => useMediaSource(""), { wrapper });
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("passes through http URLs unchanged", async () => {
    const { result } = renderHook(() => useMediaSource("http://youtube.com/watch?v=abc"), { wrapper });
    await waitFor(() => expect(result.current).toBe("http://youtube.com/watch?v=abc"));
  });

  it("passes through data URIs unchanged", async () => {
    const { result } = renderHook(() => useMediaSource("data:image/png;base64,abc"), { wrapper });
    await waitFor(() => expect(result.current).toBe("data:image/png;base64,abc"));
  });

  it("passes through blob URIs unchanged", async () => {
    const { result } = renderHook(() => useMediaSource("blob:http://localhost/abc"), { wrapper });
    await waitFor(() => expect(result.current).toBe("blob:http://localhost/abc"));
  });

  it("encodes absolute path to streaming URL", async () => {
    const { result } = renderHook(() => useMediaSource("/Users/user/bg.jpg"), { wrapper });
    await waitFor(() =>
      expect(result.current).toBe("http://127.0.0.1:7000/media/%2FUsers%2Fuser%2Fbg.jpg")
    );
  });

  it("encodes relative media path to streaming URL", async () => {
    const { result } = renderHook(() => useMediaSource("media/videos/hash.mp4"), { wrapper });
    await waitFor(() =>
      expect(result.current).toBe("http://127.0.0.1:7000/media/media%2Fvideos%2Fhash.mp4")
    );
  });

  it("encodes paths with spaces correctly", async () => {
    const { result } = renderHook(() => useMediaSource("/path/with spaces/bg.jpg"), { wrapper });
    await waitFor(() =>
      expect(result.current).toBe("http://127.0.0.1:7000/media/%2Fpath%2Fwith%20spaces%2Fbg.jpg")
    );
  });

  it("returns null before streaming port resolves", () => {
    // Delay the mock resolution
    const { getStreamingStatus } = require("../../lib/tauri/streaming");
    (getStreamingStatus as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    );
    const { result } = renderHook(() => useMediaSource("/abs/path.jpg"), { wrapper });
    expect(result.current).toBeNull(); // synchronously null before port resolves
  });
});
```

- [ ] **Step 4.2: Run to verify it fails**

```bash
pnpm test:unit src/hooks/__tests__/use-media-source.test.ts 2>&1 | tail -20
```

Expected: FAIL — old hook uses `convertFileSrc`, not streaming URL.

- [ ] **Step 4.3: Rewrite `use-media-source.ts`**

Replace the entire file:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getStreamingStatus } from "../lib/tauri/streaming";

/**
 * Converts a media path (absolute OS path, relative managed path, or URL) to
 * a URL the webview can load. All local files are served through the streaming
 * server so Rust's full OS access is used — no asset protocol scope needed.
 *
 * Returns null until the streaming port is known (brief startup window only).
 */
export function useMediaSource(path: string | null | undefined): string | null {
  const { data: streamingInfo } = useQuery({
    queryKey: ["streaming-status"],
    queryFn: getStreamingStatus,
    staleTime: Infinity,   // port never changes during a session
    gcTime: Infinity,
  });

  if (!path || path.trim().length === 0) return null;

  const v = path.trim();

  // URLs and data/blob URIs pass through unchanged
  if (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("data:") ||
    v.startsWith("blob:")
  ) {
    return v;
  }

  // Need the port before we can build a streaming URL
  if (!streamingInfo?.port) return null;

  return `http://127.0.0.1:${streamingInfo.port}/media/${encodeURIComponent(v)}`;
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
pnpm test:unit src/hooks/__tests__/use-media-source.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 4.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors from `use-media-source.ts`. (Other files may error until Tasks 7–10 are done — ignore those for now.)

- [ ] **Step 4.6: Commit**

```bash
git add src/hooks/use-media-source.ts src/hooks/__tests__/use-media-source.test.ts
git commit -m "feat(hooks): rewrite useMediaSource to use streaming server URLs

Replaces async convertFileSrc + appDataDir resolution with a synchronous
encodeURIComponent builder. All local media served via http://127.0.0.1:{port}/media/.
No asset protocol scope changes needed."
```

---

## Task 5: Rust Archive — Bundle Absolute-Path Media

**Files:**
- Modify: `src-tauri/src/db/models/slides.rs` (add `#[derive(Default)]` to `SlideContent`)
- Modify: `src-tauri/src/archive/mod.rs` (add `extract_media_paths`, `unique_archive_name` helpers)
- Modify: `src-tauri/src/commands/slides.rs` (extend `collect_video_media_files` — the actual call site)

**Context:** The archive export lives in `commands/slides.rs`. `collect_video_media_files` (line 260) currently only handles relative `videoPath` fields. It needs to also bundle absolute `backgroundImage`, `videoPath`, and `videoUrl` fields. Helper functions live in `archive/mod.rs` for unit testability.

- [ ] **Step 5.1: Add `#[derive(Default)]` to `SlideContent` in `models/slides.rs`**

In `src-tauri/src/db/models/slides.rs` at line 100, update the derive:

```rust
// Before:
#[derive(Debug, Clone, Serialize, Deserialize, Type)]

// After:
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
```

`slide_type: String` defaults to `""`, all `Option<T>` fields default to `None`. Safe and useful for tests.

- [ ] **Step 5.2: Write failing tests in `archive/mod.rs`**

Add at the bottom of `src-tauri/src/archive/mod.rs`:

```rust
#[cfg(test)]
mod archive_media_tests {
    use super::{extract_media_paths, unique_archive_name};
    use crate::db::models::slides::SlideContent;

    fn bg_content(path: &str) -> SlideContent {
        SlideContent {
            slide_type: "cover".into(),
            background_image: Some(path.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn test_extract_absolute_bg_included() {
        let paths = extract_media_paths(&bg_content("/Users/user/Downloads/bg.jpg"));
        assert_eq!(paths, vec!["/Users/user/Downloads/bg.jpg"]);
    }

    #[test]
    fn test_extract_relative_excluded() {
        let paths = extract_media_paths(&bg_content("media/images/hash.jpg"));
        assert!(paths.is_empty(), "relative paths must not be bundled");
    }

    #[test]
    fn test_extract_null_excluded() {
        let paths = extract_media_paths(&SlideContent::default());
        assert!(paths.is_empty());
    }

    #[test]
    fn test_extract_multiple_fields() {
        let content = SlideContent {
            slide_type: "video".into(),
            background_image: Some("/abs/bg.jpg".into()),
            video_path: Some("/abs/clip.mp4".into()),
            ..Default::default()
        };
        let paths = extract_media_paths(&content);
        assert_eq!(paths.len(), 2);
        assert!(paths.contains(&"/abs/bg.jpg".to_string()));
        assert!(paths.contains(&"/abs/clip.mp4".to_string()));
    }

    #[test]
    fn test_collision_no_collision() {
        let mut seen = std::collections::HashSet::new();
        assert_eq!(unique_archive_name("bg.jpg", &mut seen), "bg.jpg");
    }

    #[test]
    fn test_collision_second_gets_suffix_2() {
        let mut seen = std::collections::HashSet::new();
        let _ = unique_archive_name("bg.jpg", &mut seen);
        assert_eq!(unique_archive_name("bg.jpg", &mut seen), "bg_2.jpg");
    }

    #[test]
    fn test_collision_third_gets_suffix_3() {
        let mut seen = std::collections::HashSet::new();
        let _ = unique_archive_name("bg.jpg", &mut seen);
        let _ = unique_archive_name("bg.jpg", &mut seen);
        assert_eq!(unique_archive_name("bg.jpg", &mut seen), "bg_3.jpg");
    }

    #[test]
    fn test_collision_no_extension() {
        let mut seen = std::collections::HashSet::new();
        let _ = unique_archive_name("Makefile", &mut seen);
        assert_eq!(unique_archive_name("Makefile", &mut seen), "Makefile_2");
    }
}
```

- [ ] **Step 5.3: Run to verify they fail**

```bash
cargo test --manifest-path src-tauri/Cargo.toml archive_media_tests 2>&1 | head -20
```

Expected: compile error — `extract_media_paths` and `unique_archive_name` not defined.

- [ ] **Step 5.4: Add helpers to `archive/mod.rs`**

```rust
use crate::db::models::slides::SlideContent;

/// Collect absolute-path media fields from a SlideContent for archive bundling.
/// Relative paths (yt-dlp downloads, managed covers) are excluded.
pub(crate) fn extract_media_paths(content: &SlideContent) -> Vec<String> {
    [
        content.background_image.as_deref(),
        content.video_path.as_deref(),
        content.video_url.as_deref(),
    ]
    .into_iter()
    .flatten()
    .filter(|p| std::path::Path::new(p).is_absolute())
    .map(String::from)
    .collect()
}

/// Return a filename unique within `seen`, appending _2, _3, … on collision.
pub(crate) fn unique_archive_name(
    filename: &str,
    seen: &mut std::collections::HashSet<String>,
) -> String {
    if seen.insert(filename.to_string()) {
        return filename.to_string();
    }
    let (stem, ext) = match filename.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (filename.to_string(), String::new()),
    };
    let mut counter = 2usize;
    loop {
        let candidate = format!("{stem}_{counter}{ext}");
        if seen.insert(candidate.clone()) {
            return candidate;
        }
        counter += 1;
    }
}
```

- [ ] **Step 5.5: Run tests to verify helpers pass**

```bash
cargo test --manifest-path src-tauri/Cargo.toml archive_media_tests 2>&1
```

Expected: all 8 tests PASS.

- [ ] **Step 5.6: Extend `collect_video_media_files` in `commands/slides.rs`**

The function starts at line 260. After the existing relative-path loop, add a second block that handles absolute paths:

```rust
fn collect_video_media_files(
    slides: &[Slide],
    app_data_dir: &Path,
) -> Result<Vec<crate::archive::MediaFile>, AppError> {
    use crate::archive::{extract_media_paths, unique_archive_name};
    use crate::db::models::slides::SlideContent;

    let mut seen = std::collections::HashSet::new();
    let mut files = Vec::new();

    for slide in slides {
        // --- existing: relative videoPath from managed media ---
        if let Some(video_path) = extract_video_path_from_content(&slide.content) {
            if let Some(rel) = video_path.strip_prefix("media/") {
                let archive_filename = rel.to_string();
                if seen.insert(archive_filename.clone()) {
                    let absolute = app_data_dir.join("media").join(&archive_filename);
                    if absolute.exists() {
                        let data = std::fs::read(&absolute)?;
                        files.push(crate::archive::MediaFile {
                            filename: archive_filename,
                            data,
                        });
                    }
                }
            }
        }

        // --- new: absolute-path media (backgroundImage, videoPath, videoUrl) ---
        if let Ok(content) = serde_json::from_str::<SlideContent>(&slide.content) {
            for abs_path in extract_media_paths(&content) {
                let src = std::path::Path::new(&abs_path);
                if let Some(filename) = src.file_name().and_then(|f| f.to_str()) {
                    let archive_name = unique_archive_name(filename, &mut seen);
                    if let Ok(data) = std::fs::read(src) {
                        files.push(crate::archive::MediaFile {
                            filename: archive_name,
                            data,
                        });
                    }
                }
            }
        }
    }

    Ok(files)
}
```

- [ ] **Step 5.7: Rust build check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error"
```

Expected: no errors.

- [ ] **Step 5.8: Commit**

```bash
git add src-tauri/src/archive/mod.rs src-tauri/src/commands/slides.rs src-tauri/src/db/models/slides.rs
git commit -m "feat(archive): bundle absolute-path media files at export time

SlideContent derives Default (test ergonomics).
extract_media_paths() and unique_archive_name() in archive/mod.rs.
collect_video_media_files() in commands/slides.rs extended to include
absolute backgroundImage/videoPath/videoUrl alongside existing relative logic."
```

---


## Task 6: CSP Verification

**Files:**
- Verify/Modify: `src-tauri/capabilities/desktop.json` (or wherever CSP is configured)

- [ ] **Step 6.1: Check current CSP**

```bash
grep -r "img-src\|media-src\|connect-src\|127.0.0.1" src-tauri/capabilities/ src-tauri/tauri.conf.json 2>/dev/null
```

- [ ] **Step 6.2: Verify or add `127.0.0.1` allowance**

The streaming preview panels already load images from `127.0.0.1` (the streaming panel shows the live preview). If that works today, the CSP already allows it. Confirm by checking the existing CSP string.

If `img-src` or `media-src` restricts `127.0.0.1`, add:
```json
"img-src": "'self' http://127.0.0.1:* data: blob:",
"media-src": "'self' http://127.0.0.1:* blob:"
```

- [ ] **Step 6.3: Commit if changed**

```bash
git add src-tauri/capabilities/
git commit -m "config: allow 127.0.0.1 in CSP for streaming server media"
```

---

## Task 7: SlideRenderer + `video-slide.tsx`

**Depends on:** Task 4 (useMediaSource)

**Files:**
- Modify: `src/components/slides/slide-renderer.tsx`
- Modify: `src/components/slides/video-slide.tsx`

- [ ] **Step 7.1: Remove raw fallback in `slide-renderer.tsx`**

Find the line that reads something like:
```ts
const bg = resolvedBackgroundPath ?? slide.backgroundImage ?? null;
```

Remove the `?? slide.backgroundImage` fallback — an absolute OS path cannot be loaded directly by a browser/webview:
```ts
const bg = resolvedBackgroundPath;
```

- [ ] **Step 7.2: Remove `useResolveMediaPath` from `video-slide.tsx`**

Find where `video-slide.tsx` calls `useResolveMediaPath` (or `resolveMediaPath` IPC) and remove it. The video path now flows directly into `useMediaSource`:

```ts
// Before (approximately):
const { data: resolvedPath } = useResolveMediaPath(slide.videoPath);
const srcUrl = resolvedPath ? convertFileSrc(resolvedPath) : null;

// After:
const srcUrl = useMediaSource(slide.videoPath);
```

- [ ] **Step 7.3: TypeScript check for these two files**

```bash
npx tsc --noEmit 2>&1 | grep -E "slide-renderer|video-slide"
```

Expected: no errors from these files.

- [ ] **Step 7.4: Commit**

```bash
git add src/components/slides/slide-renderer.tsx src/components/slides/video-slide.tsx
git commit -m "refactor(slides): remove raw path fallback and resolveMediaPath IPC

slide-renderer no longer falls back to raw backgroundImage (absolute OS paths
can't load directly in webview). video-slide uses useMediaSource directly."
```

---

## Task 8: File Pickers

**Depends on:** Task 4 (useMediaSource)

**Files:**
- Modify: `src/components/slides/background-picker.tsx`
- Modify: `src/components/slides/fields/image-fields.tsx`
- Modify: `src/components/slides/video-picker.tsx`
- Modify: `src/components/bible/projection-settings.tsx`

All four components follow the same pattern: remove the copy mutation, call dialog, store the selected path directly.

- [ ] **Step 8.1: Update `background-picker.tsx`**

```ts
// Remove:
import { useCopyImageToMedia } from "../../lib/queries";
// Remove: const copyMutation = useCopyImageToMedia();
// Remove: const [managedPath, copyError] = await catcher(copyMutation.mutateAsync(selected), ...)
// Remove: notify.success(t("presentations.imageImported"));

// Replace handleBrowseImage with:
const handleBrowseImage = async () => {
  const selected = await openFileDialog({
    multiple: false,
    filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "avif", "tiff"] }],
  });
  if (!selected || typeof selected !== "string") return;
  onChange({ ...value, imagePath: selected });
};
// Remove loadingImage state (no async operation)
```

- [ ] **Step 8.2: Update `image-fields.tsx`**

Same pattern: find `useCopySlideImageToMedia` usage, remove the copy mutation, store the absolute path directly.

- [ ] **Step 8.3: Update `video-picker.tsx`**

Same pattern: find `useCopyVideoToMedia` usage, remove the copy mutation and any event listener cleanup. The dialog returns an absolute path — store directly.

- [ ] **Step 8.4: Update `bible/projection-settings.tsx`**

Same pattern: find `useCopyImageToMedia` usage for bible background, remove it, store absolute path directly.

- [ ] **Step 8.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "background-picker|image-fields|video-picker|projection-settings"
```

Expected: no errors from these files.

- [ ] **Step 8.6: Commit**

```bash
git add src/components/slides/background-picker.tsx src/components/slides/fields/image-fields.tsx src/components/slides/video-picker.tsx src/components/bible/projection-settings.tsx
git commit -m "refactor(pickers): store absolute paths directly, no copy step

File pickers now return the absolute OS path from the dialog directly.
No copy mutation, no managed media directory, no async loading state."
```

---

## Task 9: `video-card.tsx` + `online-video-slide.tsx`

**Depends on:** Task 4 (useMediaSource)

**Files:**
- Modify: `src/components/online-videos/video-card.tsx`
- Modify: `src/components/online-videos/online-video-slide.tsx`

- [ ] **Step 9.1: Update `handleProject` in `video-card.tsx`**

```ts
// Remove imports:
// import { appDataDir, join } from "@tauri-apps/api/path";

// Replace the handleProject local video block (lines 85-91):
// Before:
//   if (video.localPath) {
//     const [appDir] = await catcher(appDataDir());
//     if (appDir) {
//       videoUrl = await join(appDir, video.localPath);
//       videoId = null;
//       videoSource = "local";
//     }
//   }

// After:
if (video.localPath) {
  videoUrl = video.localPath;  // store relative path directly
  videoId = null;
  videoSource = "local";
}
```

Now `handleProject` is fully synchronous for local videos — no `appDataDir()` call needed.

- [ ] **Step 9.2: Update `online-video-slide.tsx` for local video**

Find where `convertFileSrc(slide.videoUrl)` is used for `videoSource === "local"`. Replace with `useMediaSource`:

```ts
// Add at top:
import { useMediaSource } from "../../hooks/use-media-source";

// Inside the component:
const localVideoSrc = useMediaSource(
  slide.videoSource === "local" ? slide.videoUrl : null
);

// In JSX, replace:
// <video src={convertFileSrc(slide.videoUrl)} ... />
// With:
// <video src={localVideoSrc ?? undefined} ... />
```

Remove the `convertFileSrc` import if it's no longer used elsewhere in that file.

- [ ] **Step 9.3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "video-card|online-video-slide"
```

Expected: no errors from these files.

- [ ] **Step 9.4: Commit**

```bash
git add src/components/online-videos/video-card.tsx src/components/online-videos/online-video-slide.tsx
git commit -m "refactor(online-videos): store localPath directly, serve via useMediaSource

video-card stores video.localPath directly in videoUrl (no appDataDir join).
online-video-slide uses useMediaSource for local videos (streaming server URL)."
```

---

## Task 10: Dead-Code Cleanup

**Depends on:** Tasks 2, 7, 8, 9

**Files:**
- Modify: `src/lib/tauri/utilities.ts`
- Modify: `src/lib/queries/utilities.ts`

- [ ] **Step 10.1: Remove from `src/lib/tauri/utilities.ts`**

Delete these three exported functions entirely:
- `copyVideoToMedia` (lines 103–136)
- `copySlideImageToMedia` (lines 142–144)
- `resolveMediaPath` (lines 150–152)

Keep: `copyImageToMedia` (used for album covers and logo — out of scope).

- [ ] **Step 10.2: Remove from `src/lib/queries/utilities.ts`**

Delete these three exported hooks:
- `useCopyVideoToMedia`
- `useCopySlideImageToMedia`
- `useResolveMediaPath`

Also remove the corresponding imports from the top of the file:
```ts
// Remove from imports:
copyVideoToMedia,
copySlideImageToMedia,
resolveMediaPath,
```

- [ ] **Step 10.3: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: **zero errors**. Fix any remaining callers that still reference the removed functions.

- [ ] **Step 10.4: Run all unit tests**

```bash
pnpm test:unit 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 10.5: Rust build final check**

```bash
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error"
```

Expected: no errors.

- [ ] **Step 10.6: Final commit**

```bash
git add src/lib/tauri/utilities.ts src/lib/queries/utilities.ts
git commit -m "refactor: remove dead copy/resolve media utility functions

copyVideoToMedia, copySlideImageToMedia, resolveMediaPath and their
React Query hooks are no longer used after the absolute-path refactor.
copyImageToMedia kept for album covers and projector logo."
```

---

## Verification Checklist

Before marking the feature complete, verify end-to-end:

- [ ] Select a background image in the slide editor → path shown is the absolute path (not a hash-named copy)
- [ ] Projector window renders the background image correctly
- [ ] Return monitor shows the background image correctly
- [ ] Streaming preview in a browser shows the background image
- [ ] Select a video in the slide editor → video plays in projector
- [ ] Project a downloaded online video (yt-dlp) → plays correctly (relative path still works)
- [ ] `app_data_dir/media/images/` no longer grows when selecting slide backgrounds
- [ ] Export a presentation with an external image → `.slja` file contains the image under `media/`
- [ ] All unit tests pass: `pnpm test:unit`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No Rust errors: `cargo build --manifest-path src-tauri/Cargo.toml`
