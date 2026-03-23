use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use crate::error::AppError;
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Emitter};

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

    // Build quality format string
    let format_str = match quality {
        "720" | "720p" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
        "1080" | "1080p" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        _ => "bestvideo+bestaudio/best",
    };

    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    let mut child = Command::new(binary_path)
        .args([
            "-f", format_str,
            "--merge-output-format", "mp4",
            "--newline",           // Force progress on new lines
            "--no-colors",
            "-o", output_template.to_str().unwrap_or(""),
            &url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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
