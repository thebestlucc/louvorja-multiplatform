use crate::error::AppError;
use crate::video::io_helpers::{read_u32_be, read_u64_be, read_u8};
use crate::video::metadata::ParsedVideoMetadata;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Default)]
struct WebmState {
    timecode_scale: Option<u64>,
    duration_units: Option<f64>,
    width: Option<i32>,
    height: Option<i32>,
}

pub fn parse_webm(path: &Path) -> Result<ParsedVideoMetadata, AppError> {
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
        return Err(AppError::Internal(
            "Invalid EBML unsigned integer size".into(),
        ));
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
