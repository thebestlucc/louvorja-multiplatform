use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use crate::error::AppError;
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpProgress {
    pub run_id: String,
    pub video_id: String,
    pub percent: f64,
    pub status: String, // "downloading" | "completed" | "cancelled" | "error"
}

/// Downloads a YouTube video using yt-dlp subprocess.
/// Parses progress from stdout and emits events.
/// Checks cancel_flag between progress lines.
/// Cleans up partial file on cancel/error.
pub fn download_video(
    binary_path: &Path,
    video_id: &str,
    output_dir: &Path,
    quality: &str,
    cancel_flag: Arc<AtomicBool>,
    app: &AppHandle,
    run_id: &str,
) -> Result<PathBuf, AppError> {
    std::fs::create_dir_all(output_dir)?;

    let output_path = output_dir.join(format!("{}.mp4", video_id));
    let output_template = output_dir.join(format!("{}.%(ext)s", video_id));

    // Build quality format string.
    // Prefer pre-muxed formats (no ffmpeg required) before falling back to
    // separate streams that need ffmpeg to merge.
    let format_str = match quality {
        "720" | "720p" => "best[height<=720][ext=mp4]/best[height<=720]/bestvideo[height<=720]+bestaudio/best[height<=720]",
        "1080" | "1080p" => "best[height<=1080][ext=mp4]/best[height<=1080]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        _ => "best[ext=mp4]/best/bestvideo+bestaudio/best",
    };

    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    let mut cmd = Command::new(binary_path);
    cmd.args([
            "-f", format_str,
            "--merge-output-format", "mp4",
            "--remux-video", "mp4", // Force remux to real MP4 (avoids TS-in-.mp4 container)
            "--newline",            // Force progress on new lines
            "--no-colors",
            "-o", output_template.to_str().unwrap_or(""),
            &url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to spawn yt-dlp: {}", e)))?;

    // Read stdout for progress
    let stdout = child.stdout.take()
        .ok_or_else(|| AppError::Internal("Failed to capture yt-dlp stdout".into()))?;

    let reader = std::io::BufReader::new(stdout);

    for line in reader.lines() {
        // Check cancellation
        if cancel_flag.load(Ordering::Relaxed) {
            let _ = child.kill();
            // Cleanup partial files
            cleanup_partial_files(output_dir, video_id);
            let _ = app.emit("ytdlp-progress", YtdlpProgress {
                run_id: run_id.to_string(),
                video_id: video_id.to_string(),
                percent: 0.0,
                status: "cancelled".to_string(),
            });
            return Err(AppError::Internal("Download cancelled".into()));
        }

        if let Ok(line) = line {
            // Parse progress: "[download]  45.2% of ..."
            if line.contains("[download]") && line.contains('%') {
                if let Some(percent) = parse_progress_percent(&line) {
                    let _ = app.emit("ytdlp-progress", YtdlpProgress {
                        run_id: run_id.to_string(),
                        video_id: video_id.to_string(),
                        percent,
                        status: "downloading".to_string(),
                    });
                }
            }
        }
    }

    let exit_status = child.wait()
        .map_err(|e| AppError::Internal(format!("Failed to wait for yt-dlp: {}", e)))?;

    if !exit_status.success() {
        cleanup_partial_files(output_dir, video_id);
        let _ = app.emit("ytdlp-progress", YtdlpProgress {
            run_id: run_id.to_string(),
            video_id: video_id.to_string(),
            percent: 0.0,
            status: "error".to_string(),
        });
        return Err(AppError::Internal(format!(
            "yt-dlp exited with code: {:?}",
            exit_status.code()
        )));
    }

    // Verify the output file exists
    if !output_path.exists() {
        // yt-dlp might have used a different extension before merge
        // Look for any file matching the video_id pattern
        if let Some(found) = find_output_file(output_dir, video_id) {
            let _ = app.emit("ytdlp-progress", YtdlpProgress {
                run_id: run_id.to_string(),
                video_id: video_id.to_string(),
                percent: 100.0,
                status: "completed".to_string(),
            });
            return Ok(found);
        }
        return Err(AppError::Internal("yt-dlp completed but output file not found".into()));
    }

    let _ = app.emit("ytdlp-progress", YtdlpProgress {
        run_id: run_id.to_string(),
        video_id: video_id.to_string(),
        percent: 100.0,
        status: "completed".to_string(),
    });

    Ok(output_path)
}

fn parse_progress_percent(line: &str) -> Option<f64> {
    // Format: "[download]  45.2% of ~123.45MiB ..."
    let after_download = line.split("[download]").nth(1)?;
    let percent_str = after_download.trim().split('%').next()?.trim();
    percent_str.parse::<f64>().ok()
}

fn cleanup_partial_files(output_dir: &Path, video_id: &str) {
    if let Ok(entries) = std::fs::read_dir(output_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with(video_id) && (name_str.contains(".part") || name_str.contains(".ytdl")) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

/// Deletes ALL files in `output_dir` whose name starts with `video_id`
/// (covers .mp4, .webm, separate audio tracks, etc.).
pub fn delete_video_files(output_dir: &Path, video_id: &str) {
    if let Ok(entries) = std::fs::read_dir(output_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with(video_id) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

fn find_output_file(output_dir: &Path, video_id: &str) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(output_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with(video_id) && !name_str.contains(".part") && !name_str.contains(".ytdl") {
                return Some(entry.path());
            }
        }
    }
    None
}

/// Resolve a YouTube video to a single direct streaming URL via yt-dlp.
///
/// v1 prefers a single muxed format (`best[ext=mp4]/best`) to avoid the
/// ffmpeg-mux requirement for split video+audio formats. Lower quality is
/// acceptable for v1; see plan Section 10
/// (`docs/plans/2026-04-17-rust-video-pipeline.md`) for v2 split-format
/// work.
///
/// The leading `[protocol=https]` filter forces yt-dlp to pick a progressive
/// HTTPS MP4 stream and excludes HLS-segmented (`m3u8_native` / `m3u8`) and
/// DASH variants. HLS-backed selections cause:
///   - fragment redownload on loop/restart (each segment refetched),
///   - `GstTSDemux:tsdemux2: CONTINUITY` warnings at every segment boundary,
///   - mid-session URL expiration (per-fragment signed URLs).
/// Progressive MP4 is served via `qtdemux` (core gst-plugins-good, always
/// present), uses a single signed URL valid for hours, and lets the in-place
/// pipeline restart from Phase 3 simply rewind via `seek_simple(0)`.
///
/// Trade-off: progressive MP4 caps at itag 22 (~720p) for most YouTube
/// videos — higher resolutions are only available as split video+audio
/// (DASH). 720p is acceptable for the projection use case. Fallback chain
/// is preserved if no progressive variant is available (rare).
///
/// See `docs/plans/2026-04-26-video-loop-and-first-play-recovery.md`
/// (Phase 4) for the full rationale.
///
/// Blocking: spawns `yt-dlp` and waits for it to print a URL on stdout.
/// Callers from async contexts should wrap with
/// `tokio::task::spawn_blocking`.
pub fn resolve_streaming_url(binary_path: &Path, video_id: &str) -> Result<String, AppError> {
    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    let mut cmd = Command::new(binary_path);
    // Prefer formats that include audio: video-only streams cause GStreamer's
    // autoaudiosink to receive no data and produce silent playback. The final
    // `/best` keeps the v1 single-URL contract (no ffmpeg mux) as last resort.
    cmd.arg("-f")
        .arg("best[ext=mp4][acodec!=none][protocol=https]/best[ext=mp4][acodec!=none]/best[acodec!=none]/best")
        .arg("--get-url")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg(&url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| AppError::Internal(format!("yt-dlp spawn failed: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Internal(format!(
            "yt-dlp exit {}: {}",
            output.status.code().unwrap_or(-1),
            stderr.trim()
        )));
    }

    // Take only the first line: if the format falls back to a split
    // video+audio format, yt-dlp prints two URLs separated by a newline.
    // Passing both to GStreamer produces an invalid URI with an embedded
    // newline. v1 is single-URL only; v2 split-format support is tracked
    // in source.rs TODO(v2) and the plan doc.
    let stdout = String::from_utf8_lossy(&output.stdout);
    let resolved = stdout.lines().next().unwrap_or("").trim().to_string();
    if resolved.is_empty() {
        return Err(AppError::Internal(
            "yt-dlp returned empty URL".to_string(),
        ));
    }
    if !resolved.starts_with("http") {
        return Err(AppError::Internal(format!(
            "yt-dlp returned non-HTTP URL: {resolved}"
        )));
    }
    Ok(resolved)
}
