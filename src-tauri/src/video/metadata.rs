use crate::error::AppError;
use crate::video::mp4_parser::parse_mp4;
use crate::video::path::{ensure_supported_video, format_from_path};
use crate::video::webm_parser::parse_webm;
use serde_json::Value;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use wait_timeout::ChildExt;

#[derive(Debug, Clone)]
pub struct ParsedVideoMetadata {
    pub duration_ms: i64,
    pub width: i32,
    pub height: i32,
    pub format: String,
}

pub fn parse_video_metadata(path: &Path) -> Result<ParsedVideoMetadata, AppError> {
    let format = ensure_supported_video(path)?;
    let mut magic = [0u8; 12];
    let mut file = File::open(path)?;
    let read = file.read(&mut magic)?;

    match format.as_str() {
        // MP4, MOV, M4V, and 3GP all use ISO BMFF (ISO base media file format).
        // MP4 files start with an `ftyp` box at offset 4. MOV files may start
        // with `ftyp`, `moov`, `wide`, `free`, or `mdat` atoms instead.
        "mp4" | "mov" | "m4v" | "3gp" => {
            if read < 8 {
                return Err(AppError::Internal("File too small for ISO BMFF container".into()));
            }
            let sig = &magic[4..8];
            let valid_iso_bmff = sig == b"ftyp"
                || sig == b"moov"
                || sig == b"wide"
                || sig == b"free"
                || sig == b"mdat";
            if !valid_iso_bmff {
                return Err(AppError::Internal(format!(
                    "Invalid {} file header",
                    format.to_uppercase()
                )));
            }
            parse_mp4(path)
        }
        "webm" => {
            if read < 4 || magic[0..4] != [0x1A, 0x45, 0xDF, 0xA3] {
                return Err(AppError::Internal("Invalid WebM file header".into()));
            }
            parse_webm(path)
        }
        // OGV (Ogg Theora): no native parser — falls through to ffprobe fallback
        _ => Err(AppError::Internal(format!(
            "No native parser for .{} — use ffprobe fallback",
            format
        ))),
    }
}

pub fn parse_video_metadata_with_ffprobe(
    path: &Path,
    configured_binary: Option<&str>,
    timeout_ms: u64,
) -> Result<ParsedVideoMetadata, AppError> {
    let binary = resolve_ffprobe_binary(configured_binary)?;

    let mut child = Command::new(&binary)
        .arg("-v")
        .arg("error")
        .arg("-print_format")
        .arg("json")
        .arg("-show_streams")
        .arg("-show_format")
        .arg(path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            AppError::Internal(format!(
                "Failed to start ffprobe at '{}': {}",
                binary.display(),
                e
            ))
        })?;

    let timeout = Duration::from_millis(timeout_ms);
    let status = match child.wait_timeout(timeout)? {
        Some(status) => status,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(AppError::Internal(
                "ffprobe timed out while reading video metadata".into(),
            ));
        }
    };

    let mut stdout = String::new();
    if let Some(mut s) = child.stdout.take() {
        s.read_to_string(&mut stdout)?;
    }

    let mut stderr = String::new();
    if let Some(mut s) = child.stderr.take() {
        s.read_to_string(&mut stderr)?;
    }

    if !status.success() {
        return Err(AppError::Internal(format!(
            "ffprobe failed: {}",
            stderr.trim()
        )));
    }

    let json: Value = serde_json::from_str(&stdout)
        .map_err(|e| AppError::Internal(format!("Failed to parse ffprobe JSON output: {}", e)))?;

    let video_stream = json
        .get("streams")
        .and_then(|s| s.as_array())
        .and_then(|streams| {
            streams.iter().find(|s| {
                s.get("codec_type")
                    .and_then(|v| v.as_str())
                    .map(|v| v == "video")
                    .unwrap_or(false)
            })
        })
        .ok_or_else(|| {
            AppError::Internal("ffprobe output did not include a video stream".into())
        })?;

    let width = video_stream
        .get("width")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;
    let height = video_stream
        .get("height")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    let stream_duration_seconds = video_stream
        .get("duration")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok());

    let format_duration_seconds = json
        .get("format")
        .and_then(|v| v.get("duration"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok());

    let duration_ms = stream_duration_seconds
        .or(format_duration_seconds)
        .map(|seconds| (seconds * 1000.0).round() as i64)
        .unwrap_or(0);

    if duration_ms <= 0 || width <= 0 || height <= 0 {
        return Err(AppError::Internal(
            "ffprobe metadata was incomplete for this video".into(),
        ));
    }

    let format = format_from_path(path).unwrap_or_else(|| "unknown".into());

    Ok(ParsedVideoMetadata {
        duration_ms,
        width,
        height,
        format,
    })
}

fn resolve_ffprobe_binary(configured_binary: Option<&str>) -> Result<PathBuf, AppError> {
    if let Some(path) = configured_binary
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        return Ok(PathBuf::from(path));
    }

    which::which("ffprobe")
        .map_err(|_| AppError::Internal("ffprobe is not available in PATH".into()))
}
