//! Media source resolution for the Rust video pipeline.
//!
//! Maps a [`MediaSource`] to a single URI consumable by GStreamer's
//! `uridecodebin` (`file://...` for local files, `https://...` for remote
//! YouTube streams). YouTube resolution shells out to `yt-dlp` to fetch a
//! direct download URL.
//!
//! TODO(v2 — split-format): Modern YouTube commonly splits video and audio
//! into separate formats requiring an ffmpeg mux. v1 prefers a format that
//! yields a single URL (`best[ext=mp4]/best`) even at lower quality. v2 will
//! return a `Vec<String>` and let the GStreamer pipeline use two
//! `uridecodebin` elements muxed together. See plan Section 10
//! (open questions: YouTube split-format support) at
//! `docs/plans/2026-04-17-rust-video-pipeline.md`.
//!
//! Note: [`MediaSource::resolve_uri`] is intentionally synchronous to match
//! the existing `ytdlp` module pattern (`std::process::Command` + blocking
//! HTTP). Callers from async contexts should wrap with
//! `tokio::task::spawn_blocking`.
//!
//! Plan reference: `docs/plans/2026-04-17-rust-video-pipeline.md`, Task 1.4.
#![allow(dead_code)]

use std::path::{Path, PathBuf};

use crate::error::AppError;

/// A media source that can be resolved to a GStreamer-compatible URI.
///
/// Wire format (Tauri IPC, internally tagged):
/// - `{ "type": "local", "absolutePath": "/abs/path.mp4" }`
/// - `{ "type": "youtube", "videoId": "dQw4w9WgXcQ" }`
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MediaSource {
    /// Local file on disk. `absolute_path` MUST be absolute; relative paths
    /// are rejected at resolution time.
    #[serde(rename_all = "camelCase")]
    Local { absolute_path: PathBuf },
    /// YouTube video, identified by its 11-character video ID.
    #[serde(rename_all = "camelCase")]
    Youtube { video_id: String },
}

impl MediaSource {
    /// Stable identity key for snapshot dedup. Unlike [`Self::resolve_uri`]
    /// — which can return a fresh signed URL on every call for the YouTube
    /// variant (yt-dlp re-fetches the manifest each time) — this key is
    /// fully deterministic for a given source value:
    ///
    /// - `MediaSource::Local { absolute_path }` → `"local:{absolute_path}"`
    /// - `MediaSource::Youtube { video_id }` → `"youtube:{video_id}"`
    ///
    /// Used by the runtime's same-source dispatch matrix
    /// (`runtime::load`) to route repeated loads of the same logical
    /// source to in-place `restart()` instead of a full `load_full()`
    /// rebuild. Comparing `resolve_uri()` strings directly does not work
    /// for YouTube because the signed URL rotates on every resolution
    /// (`expire`, `sig`, `lsig`, `pot` query params change each call).
    ///
    /// See `docs/plans/2026-04-26-phase5-hotfix-source-identity-dedup.md`.
    pub fn identity_key(&self) -> String {
        match self {
            MediaSource::Local { absolute_path } => {
                format!("local:{}", absolute_path.display())
            }
            MediaSource::Youtube { video_id } => {
                format!("youtube:{}", video_id)
            }
        }
    }

    /// Resolve this source to a single URI suitable for `uridecodebin`.
    ///
    /// `ytdlp_binary` is the path to the `yt-dlp` executable. It is unused
    /// for the [`MediaSource::Local`] variant.
    ///
    /// Blocking: the YouTube variant spawns `yt-dlp` as a child process and
    /// waits for it to print a direct URL. May take a few seconds.
    pub fn resolve_uri(&self, ytdlp_binary: &Path) -> Result<String, AppError> {
        match self {
            MediaSource::Local { absolute_path } => {
                if !absolute_path.is_absolute() {
                    return Err(AppError::Internal(format!(
                        "MediaSource::Local requires an absolute path, got: {}",
                        absolute_path.display()
                    )));
                }
                // P3.8 fix S3: surface a clear `NotFound` when a managed
                // download has been deleted from disk (or never finished).
                // GStreamer's `uridecodebin` will otherwise post an opaque
                // bus ERROR like "Resource not found" deep in the watcher
                // thread, with no actionable hint for the user. Catching
                // missing files here lets the IPC reply carry a structured
                // error the frontend can translate into a "video file
                // missing — re-download?" toast.
                if !absolute_path.exists() {
                    return Err(AppError::NotFound(format!(
                        "Local media file not found on disk: {} \
                         (the download may have been deleted; re-download from the Online Videos panel)",
                        absolute_path.display()
                    )));
                }
                // Normalize backslashes (Windows) so the URI is well-formed.
                let path_str = absolute_path.display().to_string().replace('\\', "/");
                Ok(format!("file://{}", path_str))
            }
            MediaSource::Youtube { video_id } => {
                crate::ytdlp::downloader::resolve_streaming_url(ytdlp_binary, video_id)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Dummy binary path — never invoked for the Local variant.
    fn dummy_binary() -> &'static Path {
        Path::new("/usr/bin/false")
    }

    #[test]
    fn local_resolves_to_file_uri() {
        // Need a file that actually exists for the existence guard added in
        // P3.8 fix S3. /tmp is portable across CI runners.
        let path = std::env::temp_dir().join("__louvorja_resolves_to_file_uri__.mp4");
        std::fs::write(&path, b"").expect("write temp");
        let source = MediaSource::Local {
            absolute_path: path.clone(),
        };
        let uri = source.resolve_uri(dummy_binary()).expect("resolve");
        let expected = format!("file://{}", path.display());
        assert_eq!(uri, expected);
        let _ = std::fs::remove_file(&path);
    }

    /// On Windows, `C:\videos\foo.mp4` is absolute and must be normalized to
    /// `file://C:/videos/foo.mp4`. On Unix, `PathBuf::from(r"C:\...")`  is
    /// NOT absolute, so the end-to-end call is windows-only. We always
    /// validate the normalization rule itself (helper-style) so the
    /// contract is tested on every platform.
    #[test]
    fn local_normalizes_windows_backslashes() {
        // Helper-level: backslash → forward slash, prefixed with file://.
        // This is what `resolve_uri` does internally.
        let normalized = PathBuf::from(r"C:\videos\foo.mp4")
            .display()
            .to_string()
            .replace('\\', "/");
        assert_eq!(normalized, "C:/videos/foo.mp4");
        assert_eq!(format!("file://{}", normalized), "file://C:/videos/foo.mp4");

        // End-to-end on Windows only (Unix considers `C:\...` non-absolute
        // and would correctly reject it via the absolute-path guard).
        #[cfg(windows)]
        {
            let source = MediaSource::Local {
                absolute_path: PathBuf::from(r"C:\videos\foo.mp4"),
            };
            let uri = source.resolve_uri(dummy_binary()).expect("resolve");
            assert_eq!(uri, "file://C:/videos/foo.mp4");
        }
    }

    #[test]
    fn local_relative_path_rejected() {
        let source = MediaSource::Local {
            absolute_path: PathBuf::from("relative/path.mp4"),
        };
        let err = source.resolve_uri(dummy_binary()).expect_err("should reject");
        match err {
            AppError::Internal(msg) => {
                assert!(
                    msg.contains("absolute path"),
                    "expected 'absolute path' in error, got: {msg}"
                );
            }
            other => panic!("expected AppError::Internal, got: {other:?}"),
        }
    }

    /// P3.8 fix S3: a managed download path that points at a missing file
    /// must surface as `AppError::NotFound`, not a generic Internal that
    /// gets folded into GStreamer "Resource not found" later in the run.
    #[test]
    fn local_missing_file_returns_not_found() {
        let source = MediaSource::Local {
            absolute_path: PathBuf::from("/tmp/__louvorja_definitely_does_not_exist__.mp4"),
        };
        let err = source.resolve_uri(dummy_binary()).expect_err("should reject");
        match err {
            AppError::NotFound(msg) => {
                assert!(
                    msg.contains("not found on disk"),
                    "expected 'not found on disk' in error, got: {msg}"
                );
            }
            other => panic!("expected AppError::NotFound, got: {other:?}"),
        }
    }

    /// Existing files under the absolute-path contract must resolve
    /// successfully (regression guard for the new exists() check).
    #[test]
    fn local_existing_file_resolves_to_file_uri() {
        // /tmp is guaranteed writable on every platform we ship to.
        let path = std::env::temp_dir().join("__louvorja_resolve_uri_test__.mp4");
        // Touch the file so `exists()` returns true. Don't actually decode
        // it — the test only exercises the URI build path.
        std::fs::write(&path, b"").expect("write temp");
        let source = MediaSource::Local {
            absolute_path: path.clone(),
        };
        let uri = source.resolve_uri(dummy_binary()).expect("resolve");
        assert!(uri.starts_with("file://"), "expected file:// URI, got: {uri}");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn identity_key_local_uses_absolute_path_prefix() {
        let source = MediaSource::Local {
            absolute_path: PathBuf::from("/abs/videos/foo.mp4"),
        };
        assert_eq!(source.identity_key(), "local:/abs/videos/foo.mp4");
    }

    #[test]
    fn identity_key_youtube_uses_video_id_prefix() {
        let source = MediaSource::Youtube {
            video_id: "dQw4w9WgXcQ".to_string(),
        };
        assert_eq!(source.identity_key(), "youtube:dQw4w9WgXcQ");
    }

    /// The identity key MUST be deterministic across calls — it is the
    /// snapshot dispatch key. Two YouTube sources with the same `video_id`
    /// must produce the same key even though `resolve_uri()` would
    /// produce a fresh signed URL each call.
    #[test]
    fn identity_key_is_deterministic_per_value() {
        let a = MediaSource::Youtube { video_id: "X".into() };
        let b = MediaSource::Youtube { video_id: "X".into() };
        assert_eq!(a.identity_key(), b.identity_key());
        assert_eq!(a.identity_key(), "youtube:X");
    }

    /// Manual / network test. Run with:
    ///   cargo test --manifest-path src-tauri/Cargo.toml \
    ///       video_pipeline::source -- --ignored
    /// Requires `yt-dlp` on PATH.
    #[test]
    #[ignore]
    fn youtube_resolves_known_video() {
        let binary = which::which("yt-dlp").expect("yt-dlp on PATH for ignored test");
        let source = MediaSource::Youtube {
            video_id: "dQw4w9WgXcQ".to_string(), // famously stable
        };
        let url = source.resolve_uri(&binary).expect("resolve");
        assert!(
            url.starts_with("http"),
            "expected http(s) URL, got: {url}"
        );
    }
}
