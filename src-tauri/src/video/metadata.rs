use crate::error::AppError;
use crate::video::path::{ensure_supported_video, format_from_path};
use serde_json::Value;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
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

#[derive(Default)]
struct Mp4State {
    duration_ms: Option<i64>,
    width: Option<i32>,
    height: Option<i32>,
}

#[derive(Default)]
struct WebmState {
    timecode_scale: Option<u64>,
    duration_units: Option<f64>,
    width: Option<i32>,
    height: Option<i32>,
}

pub fn parse_video_metadata(path: &Path) -> Result<ParsedVideoMetadata, AppError> {
    let format = ensure_supported_video(path)?;
    let mut magic = [0u8; 12];
    let mut file = File::open(path)?;
    let read = file.read(&mut magic)?;

    match format.as_str() {
        "mp4" => {
            if read < 8 || &magic[4..8] != b"ftyp" {
                return Err(AppError::Internal("Invalid MP4 file header".into()));
            }
            parse_mp4(path)
        }
        "webm" => {
            if read < 4 || magic[0..4] != [0x1A, 0x45, 0xDF, 0xA3] {
                return Err(AppError::Internal("Invalid WebM file header".into()));
            }
            parse_webm(path)
        }
        _ => Err(AppError::Internal("Unsupported video format".into())),
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

    let json: Value = serde_json::from_str(&stdout).map_err(|e| {
        AppError::Internal(format!("Failed to parse ffprobe JSON output: {}", e))
    })?;

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
        .ok_or_else(|| AppError::Internal("ffprobe output did not include a video stream".into()))?;

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
    if let Some(path) = configured_binary.map(|v| v.trim()).filter(|v| !v.is_empty()) {
        return Ok(PathBuf::from(path));
    }

    which::which("ffprobe")
        .map_err(|_| AppError::Internal("ffprobe is not available in PATH".into()))
}

fn parse_mp4(path: &Path) -> Result<ParsedVideoMetadata, AppError> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let file_len = reader.seek(SeekFrom::End(0))?;
    reader.seek(SeekFrom::Start(0))?;

    let mut state = Mp4State::default();
    parse_mp4_boxes(&mut reader, file_len, &mut state)?;

    let duration_ms = state.duration_ms.unwrap_or(0);
    let width = state
        .width
        .filter(|v| *v > 0)
        .ok_or_else(|| AppError::Internal("Could not determine MP4 width".into()))?;
    let height = state
        .height
        .filter(|v| *v > 0)
        .ok_or_else(|| AppError::Internal("Could not determine MP4 height".into()))?;

    Ok(ParsedVideoMetadata {
        duration_ms,
        width,
        height,
        format: "mp4".to_string(),
    })
}

fn parse_mp4_boxes<R: Read + Seek>(
    reader: &mut R,
    end: u64,
    state: &mut Mp4State,
) -> Result<(), AppError> {
    while reader.stream_position()? < end {
        let box_start = reader.stream_position()?;
        if end.saturating_sub(box_start) < 8 {
            break;
        }

        let size = read_u32_be(reader)? as u64;
        let mut box_type = [0u8; 4];
        reader.read_exact(&mut box_type)?;

        let mut header_size = 8u64;
        let box_size = if size == 1 {
            header_size = 16;
            read_u64_be(reader)?
        } else if size == 0 {
            end - box_start
        } else {
            size
        };

        if box_size < header_size {
            return Err(AppError::Internal("Invalid MP4 box size".into()));
        }

        let payload_start = box_start + header_size;
        let payload_end = box_start + box_size;
        if payload_end > end {
            return Err(AppError::Internal("MP4 box exceeds container bounds".into()));
        }

        match &box_type {
            b"moov" | b"trak" | b"mdia" | b"minf" | b"stbl" | b"edts" | b"moof" | b"traf" | b"mvex" => {
                reader.seek(SeekFrom::Start(payload_start))?;
                parse_mp4_boxes(reader, payload_end, state)?;
            }
            b"mvhd" => {
                reader.seek(SeekFrom::Start(payload_start))?;
                if let Ok(duration_ms) = parse_mvhd(reader) {
                    if duration_ms > 0 {
                        state.duration_ms = Some(duration_ms);
                    }
                }
            }
            b"mdhd" => {
                reader.seek(SeekFrom::Start(payload_start))?;
                if let Ok(duration_ms) = parse_mdhd(reader) {
                    if duration_ms > 0 {
                        state.duration_ms = Some(duration_ms);
                    }
                }
            }
            b"tkhd" => {
                reader.seek(SeekFrom::Start(payload_start))?;
                if let Ok((width, height)) = parse_tkhd(reader) {
                    if width > 0 && height > 0 {
                        let current_area = state.width.unwrap_or(0) * state.height.unwrap_or(0);
                        let new_area = width * height;
                        if new_area >= current_area {
                            state.width = Some(width);
                            state.height = Some(height);
                        }
                    }
                }
            }
            _ => {}
        }

        reader.seek(SeekFrom::Start(payload_end))?;
    }

    Ok(())
}

fn parse_mvhd<R: Read + Seek>(reader: &mut R) -> Result<i64, AppError> {
    let version = read_u8(reader)?;
    skip_exact(reader, 3)?;

    let (timescale, duration) = if version == 1 {
        skip_exact(reader, 16)?;
        let timescale = read_u32_be(reader)? as u64;
        let duration = read_u64_be(reader)?;
        (timescale, duration)
    } else {
        skip_exact(reader, 8)?;
        let timescale = read_u32_be(reader)? as u64;
        let duration = read_u32_be(reader)? as u64;
        (timescale, duration)
    };

    if timescale == 0 {
        return Err(AppError::Internal("Invalid MP4 timescale".into()));
    }

    Ok(((duration as f64) * 1000.0 / (timescale as f64)).round() as i64)
}

fn parse_mdhd<R: Read + Seek>(reader: &mut R) -> Result<i64, AppError> {
    let version = read_u8(reader)?;
    skip_exact(reader, 3)?;

    let (timescale, duration) = if version == 1 {
        skip_exact(reader, 16)?;
        let timescale = read_u32_be(reader)? as u64;
        let duration = read_u64_be(reader)?;
        (timescale, duration)
    } else {
        skip_exact(reader, 8)?;
        let timescale = read_u32_be(reader)? as u64;
        let duration = read_u32_be(reader)? as u64;
        (timescale, duration)
    };

    if timescale == 0 {
        return Err(AppError::Internal("Invalid MP4 mdhd timescale".into()));
    }

    Ok(((duration as f64) * 1000.0 / (timescale as f64)).round() as i64)
}

fn parse_tkhd<R: Read + Seek>(reader: &mut R) -> Result<(i32, i32), AppError> {
    let version = read_u8(reader)?;
    skip_exact(reader, 3)?;

    if version == 1 {
        skip_exact(reader, 16 + 4 + 4 + 8 + 8 + 2 + 2 + 2 + 2 + 36)?;
    } else {
        skip_exact(reader, 8 + 4 + 4 + 4 + 8 + 2 + 2 + 2 + 2 + 36)?;
    }

    let raw_width = read_u32_be(reader)?;
    let raw_height = read_u32_be(reader)?;

    Ok(((raw_width >> 16) as i32, (raw_height >> 16) as i32))
}

fn parse_webm(path: &Path) -> Result<ParsedVideoMetadata, AppError> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let file_len = reader.seek(SeekFrom::End(0))?;
    reader.seek(SeekFrom::Start(0))?;

    let mut state = WebmState::default();
    parse_webm_elements(&mut reader, file_len, &mut state)?;

    let width = state
        .width
        .filter(|v| *v > 0)
        .ok_or_else(|| AppError::Internal("Could not determine WebM width".into()))?;
    let height = state
        .height
        .filter(|v| *v > 0)
        .ok_or_else(|| AppError::Internal("Could not determine WebM height".into()))?;

    let timecode_scale = state.timecode_scale.unwrap_or(1_000_000) as f64;
    let duration_ms = state
        .duration_units
        .map(|duration_units| (duration_units * timecode_scale / 1_000_000.0).round() as i64)
        .unwrap_or(0);

    Ok(ParsedVideoMetadata {
        duration_ms,
        width,
        height,
        format: "webm".to_string(),
    })
}

fn parse_webm_elements<R: Read + Seek>(
    reader: &mut R,
    end: u64,
    state: &mut WebmState,
) -> Result<(), AppError> {
    while reader.stream_position()? < end {
        let element_start = reader.stream_position()?;
        if end.saturating_sub(element_start) < 2 {
            break;
        }

        let (id, _) = match read_ebml_id(reader) {
            Ok(v) => v,
            Err(_) => break,
        };
        let (size, _, unknown_size) = match read_ebml_size(reader) {
            Ok(v) => v,
            Err(_) => break,
        };

        let payload_start = reader.stream_position()?;
        let payload_end = if unknown_size {
            end
        } else {
            payload_start
                .checked_add(size)
                .ok_or_else(|| AppError::Internal("EBML size overflow".into()))?
        };

        if payload_end > end {
            break;
        }

        match id {
            0x1549A966 | 0x1654AE6B | 0xAE | 0xE0 | 0x18538067 => {
                parse_webm_elements(reader, payload_end, state)?;
            }
            0x2AD7B1 => {
                if let Ok(scale) = read_ebml_uint(reader, size) {
                    state.timecode_scale = Some(scale);
                }
            }
            0x4489 => {
                if let Ok(duration) = read_ebml_float(reader, size) {
                    state.duration_units = Some(duration);
                }
            }
            0xB0 => {
                if let Ok(width) = read_ebml_uint(reader, size) {
                    state.width = Some(width as i32);
                }
            }
            0xBA => {
                if let Ok(height) = read_ebml_uint(reader, size) {
                    state.height = Some(height as i32);
                }
            }
            _ => {}
        }

        reader.seek(SeekFrom::Start(payload_end))?;
    }

    Ok(())
}

fn read_ebml_id<R: Read>(reader: &mut R) -> Result<(u64, usize), AppError> {
    let first = read_u8(reader)?;
    let len = ebml_vint_len(first)?;

    let mut value = first as u64;
    for _ in 1..len {
        value = (value << 8) | (read_u8(reader)? as u64);
    }

    Ok((value, len))
}

fn read_ebml_size<R: Read>(reader: &mut R) -> Result<(u64, usize, bool), AppError> {
    let first = read_u8(reader)?;
    let len = ebml_vint_len(first)?;

    let marker_mask = 0x80u8 >> (len - 1);
    let mut value = (first & !marker_mask) as u64;

    for _ in 1..len {
        value = (value << 8) | (read_u8(reader)? as u64);
    }

    let max = (1u64 << (7 * len)) - 1;

    Ok((value, len, value == max))
}

fn ebml_vint_len(first: u8) -> Result<usize, AppError> {
    for len in 1..=8 {
        if first & (0x80u8 >> (len - 1)) != 0 {
            return Ok(len);
        }
    }
    Err(AppError::Internal("Invalid EBML vint length".into()))
}

fn read_ebml_uint<R: Read + Seek>(reader: &mut R, size: u64) -> Result<u64, AppError> {
    if size == 0 || size > 8 {
        return Err(AppError::Internal("Invalid EBML unsigned integer size".into()));
    }

    let mut value = 0u64;
    for _ in 0..size {
        value = (value << 8) | (read_u8(reader)? as u64);
    }

    Ok(value)
}

fn read_ebml_float<R: Read + Seek>(reader: &mut R, size: u64) -> Result<f64, AppError> {
    match size {
        4 => {
            let raw = read_u32_be(reader)?;
            Ok(f32::from_bits(raw) as f64)
        }
        8 => {
            let raw = read_u64_be(reader)?;
            Ok(f64::from_bits(raw))
        }
        _ => Err(AppError::Internal("Invalid EBML float size".into())),
    }
}

fn read_u8<R: Read>(reader: &mut R) -> Result<u8, AppError> {
    let mut b = [0u8; 1];
    reader.read_exact(&mut b)?;
    Ok(b[0])
}

fn read_u32_be<R: Read>(reader: &mut R) -> Result<u32, AppError> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(u32::from_be_bytes(buf))
}

fn read_u64_be<R: Read>(reader: &mut R) -> Result<u64, AppError> {
    let mut buf = [0u8; 8];
    reader.read_exact(&mut buf)?;
    Ok(u64::from_be_bytes(buf))
}

fn skip_exact<R: Read + Seek>(reader: &mut R, bytes: u64) -> Result<(), AppError> {
    reader.seek(SeekFrom::Current(bytes as i64))?;
    Ok(())
}
