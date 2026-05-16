use crate::error::AppError;
use crate::video::io_helpers::{read_u32_be, read_u64_be, read_u8, skip_exact};
use crate::video::metadata::ParsedVideoMetadata;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Default)]
struct Mp4State {
    duration_ms: Option<i64>,
    width: Option<i32>,
    height: Option<i32>,
}

pub fn parse_mp4(path: &Path) -> Result<ParsedVideoMetadata, AppError> {
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
        let payload_end = (box_start + box_size).min(end);
        if box_start + box_size > end {
            // Box claims to extend beyond container — tolerate this (common with
            // some encoders/remuxers that leave the last box slightly oversized).
            // Clamp to container end and stop after processing this box.
            match &box_type {
                b"moov" | b"trak" | b"mdia" | b"minf" | b"stbl" | b"edts" | b"moof"
                | b"traf" | b"mvex" => {
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
                            let current_area =
                                state.width.unwrap_or(0) * state.height.unwrap_or(0);
                            if width * height >= current_area {
                                state.width = Some(width);
                                state.height = Some(height);
                            }
                        }
                    }
                }
                _ => {}
            }
            break;
        }

        match &box_type {
            b"moov" | b"trak" | b"mdia" | b"minf" | b"stbl" | b"edts" | b"moof" | b"traf"
            | b"mvex" => {
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
